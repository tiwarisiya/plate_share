import { geminiProvider } from "@/lib/food-scan/gemini";
import { FoodScanProvider } from "@/lib/food-scan/types";

// The configured scan provider, or null when none is set up. Add other
// providers here and pick one with FOOD_SCAN_PROVIDER.
export function getFoodScanProvider(): FoodScanProvider | null {
  switch (process.env.FOOD_SCAN_PROVIDER || "gemini") {
    case "gemini":
      return geminiProvider();
    default:
      return null;
  }
}
