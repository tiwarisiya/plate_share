"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getRoleGuardRedirect, getLoginPathForRole } from "@/lib/flow";
import { Button } from "@/components/ui/button";

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
  const [partnerName, setPartnerName] = useState("Restaurant");
  const [requestTitle, setRequestTitle] = useState("Matched Request");

  const title = useMemo(() => `${partnerName} Chat`, [partnerName]);

  const loadMessages = async () => {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(getLoginPathForRole("shelter"));
      return;
    }

    const roleRedirect = await getRoleGuardRedirect("shelter", user.id);
    if (roleRedirect) {
      router.push(roleRedirect);
      return;
    }

    const { data: requestRow } = await supabase
      .from("shelter_requests")
      .select("id, shelter_id, title, status")
      .eq("id", requestId)
      .single();

    const isParticipant = !!requestRow && requestRow.status === "matched" && requestRow.shelter_id === user.id;

    setCanChat(isParticipant);

    if (!isParticipant) {
      setLoading(false);
      setError("You can only chat on your own matched requests.");
      return;
    }

    setRequestTitle(requestRow?.title || "Matched Request");

    const { data: acceptedResponse } = await supabase
      .from("request_responses")
      .select("restaurant_id")
      .eq("request_id", requestId)
      .eq("status", "accepted")
      .maybeSingle();

    if (acceptedResponse?.restaurant_id) {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", acceptedResponse.restaurant_id)
        .maybeSingle();

      setPartnerName(profileRow?.name || "Restaurant");
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

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`shelter-chat-${requestId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `request_id=eq.${requestId}` }, () => {
        void loadMessages();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "shelter_requests", filter: `id=eq.${requestId}` }, () => {
        void loadMessages();
      })
      .subscribe();

    const timer = setInterval(() => {
      void loadMessages();
    }, 15000);

    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
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
    <div className="min-h-screen bg-slate-50 p-0 md:p-6">
      <main className="mx-auto max-w-5xl rounded-none border-0 bg-white md:rounded md:border md:border-slate-200 md:shadow-sm">
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <button onClick={() => router.push("/shelter/home")} className="text-slate-600 md:hidden">
            ←
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg md:hidden">
            🍽️
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-slate-900 truncate md:text-2xl">{title}</h1>
            <p className="text-xs text-slate-500 md:text-sm">{requestTitle}</p>
          </div>
          <Button variant="secondary" className="hidden md:inline-flex" onClick={() => router.push("/shelter/home")}>
            Back
          </Button>
        </div>

        {loading ? (
          <div className="p-4 text-slate-700">Loading chat...</div>
        ) : (
          <>
            {/* Messages area */}
            <div className="h-[calc(100dvh-140px)] md:h-[500px] overflow-y-auto bg-slate-50 p-3 md:p-4">
              {messages.length === 0 ? (
                <p className="text-center text-sm text-slate-500 mt-8">No messages yet. Start the conversation.</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_role === "shelter" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
                          msg.sender_role === "shelter"
                            ? "rounded-br-sm bg-emerald-800 text-white"
                            : "rounded-bl-sm border border-slate-200 bg-white text-slate-900"
                        }`}
                      >
                        <p>{msg.message}</p>
                        <p className={`mt-1 text-[10px] ${msg.sender_role === "shelter" ? "text-emerald-200" : "text-slate-400"}`}>
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="px-4 py-2 text-sm font-semibold text-red-700">{error}</p>}

            {/* Input area */}
            <form onSubmit={sendMessage} className="sticky bottom-0 flex items-center gap-2 border-t border-slate-200 bg-white p-3 md:static md:p-4">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message"
                disabled={!canChat}
                className="h-11 flex-1 rounded-full border border-slate-300 px-4 text-sm focus:border-emerald-700 focus:outline-none md:rounded-md"
              />
              <button
                type="submit"
                disabled={!canChat || sending || !draft.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white disabled:opacity-50 md:w-auto md:rounded-md md:px-5"
              >
                <span className="md:hidden">↑</span>
                <span className="hidden md:inline">{sending ? "Sending..." : "Send"}</span>
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
