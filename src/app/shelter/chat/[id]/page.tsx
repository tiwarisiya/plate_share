"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

type ChatMessage = {
  id: string;
  sender_role: "restaurant" | "shelter";
  message: string;
  created_at: string;
};

export default function ShelterChatPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = String(params.id || "");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canChat, setCanChat] = useState(false);

  const title = useMemo(() => `Request Chat #${requestId.slice(0, 8)}`, [requestId]);

  const loadMessages = async () => {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/shelter/register");
      return;
    }

    const { data: requestRow } = await supabase
      .from("shelter_requests")
      .select("id, shelter_id, status")
      .eq("id", requestId)
      .single();

    const isParticipant = !!requestRow && requestRow.status === "matched" && requestRow.shelter_id === user.id;

    setCanChat(isParticipant);

    if (!isParticipant) {
      setLoading(false);
      setError("You can only chat on your own matched requests.");
      return;
    }

    const { data, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id, sender_role, message, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      setError(messagesError.message);
      setLoading(false);
      return;
    }

    setMessages((data || []) as ChatMessage[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!requestId) return;

    void loadMessages();

    const timer = setInterval(() => {
      void loadMessages();
    }, 4000);

    return () => clearInterval(timer);
  }, [requestId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !canChat) return;

    setSending(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Please sign in again.");
      }

      const { error: insertError } = await supabase.from("chat_messages").insert([
        {
          request_id: requestId,
          sender_id: user.id,
          sender_role: "shelter",
          message: draft.trim(),
        },
      ]);

      if (insertError) {
        throw new Error(insertError.message);
      }

      setDraft("");
      await loadMessages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send message.";
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-yellow-50 p-6 font-sans">
      <main className="mx-auto max-w-4xl rounded-2xl border-2 border-emerald-100 bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-emerald-900">{title}</h1>
            <p className="text-sm text-emerald-700">Direct conversation with the matched restaurant.</p>
          </div>
          <button
            onClick={() => router.push("/shelter/home")}
            className="rounded-full border-2 border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            Back
          </button>
        </div>

        {loading ? (
          <div className="rounded-lg border border-emerald-200 bg-yellow-50 p-4 text-emerald-900">Loading chat...</div>
        ) : (
          <>
            <div className="h-[420px] overflow-y-auto rounded-xl border border-emerald-200 bg-yellow-50 p-4">
              {messages.length === 0 ? (
                <p className="text-sm text-emerald-700">No messages yet. Start the conversation.</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                        msg.sender_role === "shelter"
                          ? "ml-auto bg-emerald-600 text-white"
                          : "bg-white text-emerald-900 border border-emerald-200"
                      }`}
                    >
                      <p>{msg.message}</p>
                      <p className={`mt-1 text-[11px] ${msg.sender_role === "shelter" ? "text-emerald-100" : "text-emerald-600"}`}>
                        {new Date(msg.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}

            <form onSubmit={sendMessage} className="mt-4 flex gap-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message"
                disabled={!canChat}
                className="flex-1 rounded-lg border-2 border-emerald-200 px-4 py-3 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!canChat || sending || !draft.trim()}
                className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
