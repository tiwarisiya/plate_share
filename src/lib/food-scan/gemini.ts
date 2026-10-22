import { ALLERGENS, STORAGE_TYPES } from "@/lib/food-safety";
import { FoodScanProvider, FoodScanUnavailableError, sanitizeSuggestions } from "@/lib/food-scan/types";

// Google Gemini (free tier works). Server-only: reads GEMINI_API_KEY.
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 20000;

// Tried in order; a model that's retired or not offered to this key (404)
// is skipped. GEMINI_MODEL (comma-separated) overrides the list.
const DEFAULT_MODELS = ["gemini-3-flash-preview", "gemini-3.5-flash", "gemini-3.1-flash-lite"];

const PROMPT = `You help a restaurant list surplus food for donation to a shelter.
Look at the photo and suggest values for the donation form. Be conservative:
- If the photo does not show food, set is_food to false and leave the rest empty.
- allergens: only from the allowed list, and include any that are likely from the visible dishes (e.g. cheese -> milk, bread or pasta -> wheat). Allergens can't be confirmed from a photo; the restaurant will check.
- storage_type: how this food should be kept for transport.
- estimated_servings and estimated_weight_lbs: rough estimates of everything visible, or null if you can't tell.
- concerns: short food-safety observations visible in the photo (uncovered food, possible spoilage, no label). Empty if none.
- Never describe people.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_food: { type: "BOOLEAN" },
    food_name: { type: "STRING", nullable: true },
    description: { type: "STRING", nullable: true },
    estimated_servings: { type: "INTEGER", nullable: true },
    estimated_weight_lbs: { type: "NUMBER", nullable: true },
    allergens: { type: "ARRAY", items: { type: "STRING", enum: ALLERGENS.map(([key]) => key) } },
    storage_type: { type: "STRING", enum: STORAGE_TYPES.map(([key]) => key), nullable: true },
    concerns: { type: "ARRAY", items: { type: "STRING" } },
    confidence: { type: "STRING", enum: ["low", "medium", "high"] },
  },
  required: ["is_food", "allergens", "concerns", "confidence"],
};

type GeminiBody = { candidates?: { content?: { parts?: { text?: string }[] } }[] };

export function geminiProvider(): FoodScanProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const models = (process.env.GEMINI_MODEL || DEFAULT_MODELS.join(",")).split(",").map((m) => m.trim()).filter(Boolean);

  const provider: FoodScanProvider = {
    name: "gemini",
    model: models[0],
    async scan(image) {
      const request = JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: image.mimeType, data: Buffer.from(image.data).toString("base64") } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, temperature: 0.2 },
      });

      for (const model of models) {
        const res = await fetch(`${API_BASE}/${model}:generateContent`, {
          method: "POST",
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: request,
        });

        if (res.status === 404) continue;
        if (res.status === 429 || res.status === 403 || res.status >= 500) {
          throw new FoodScanUnavailableError(`Gemini ${model} returned ${res.status}`);
        }
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(`Gemini ${model} returned ${res.status}: ${detail.slice(0, 300)}`);
        }

        provider.model = model;
        const body = (await res.json()) as GeminiBody;
        const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
        try {
          return sanitizeSuggestions(JSON.parse(text));
        } catch {
          throw new Error(`Gemini ${model} returned an unreadable answer`);
        }
      }

      throw new FoodScanUnavailableError(`None of the Gemini models are available: ${models.join(", ")}`);
    },
  };
  return provider;
}
