"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  pending?: boolean;
}

interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀"];

export function ChatRoom({
  currentUserId,
  canChat,
  canReact,
  profiles,
  initialMessages,
  initialReactions,
}: {
  currentUserId: string;
  canChat: boolean;
  canReact: boolean;
  profiles: { id: string; full_name: string }[];
  initialMessages: ChatMessage[];
  initialReactions: ChatReaction[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [reactions, setReactions] = useState<ChatReaction[]>(initialReactions);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((p) => map.set(p.id, p.full_name || "Unnamed"));
    return map;
  }, [profiles]);

  useEffect(() => {
    const channel = supabase
      .channel("chat-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            const withoutOptimistic = prev.filter(
              (m) =>
                !(m.pending && m.user_id === row.user_id && m.content === row.content),
            );
            return [...withoutOptimistic, row];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions" },
        (payload) => {
          const row = payload.new as ChatReaction;
          setReactions((prev) =>
            prev.some((r) => r.id === row.id) ? prev : [...prev, row],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions" },
        (payload) => {
          const row = payload.old as { id: string };
          setReactions((prev) => prev.filter((r) => r.id !== row.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;

    setError(null);
    setDraft("");

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        user_id: currentUserId,
        content,
        created_at: new Date().toISOString(),
        pending: true,
      },
    ]);

    const { error } = await supabase.rpc("send_message", { p_content: content });
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(error.message);
    }
  }

  async function handleReact(messageId: string, emoji: string) {
    const { error } = await supabase.rpc("toggle_reaction", {
      p_message_id: messageId,
      p_emoji: emoji,
    });
    if (error) setError(error.message);
  }

  function reactionSummary(messageId: string) {
    const forMessage = reactions.filter((r) => r.message_id === messageId);
    const byEmoji = new Map<string, { count: number; reactedByMe: boolean }>();
    for (const r of forMessage) {
      const entry = byEmoji.get(r.emoji) ?? { count: 0, reactedByMe: false };
      entry.count += 1;
      if (r.user_id === currentUserId) entry.reactedByMe = true;
      byEmoji.set(r.emoji, entry);
    }
    return Array.from(byEmoji.entries());
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <h1 className="text-lg font-semibold mb-3">Chat</h1>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((message) => {
          const isMe = message.user_id === currentUserId;
          const summary = reactionSummary(message.id);

          return (
            <div key={message.id} className={isMe ? "text-right" : ""}>
              <div
                className={`inline-block max-w-[80%] rounded-xl px-3 py-2 text-sm text-left ${
                  isMe
                    ? "bg-acacia-black text-white"
                    : "bg-surface-border text-acacia-black"
                } ${message.pending ? "opacity-60" : ""}`}
              >
                {!isMe && (
                  <p className="text-xs font-semibold text-acacia-gold mb-0.5">
                    {nameById.get(message.user_id) ?? "Unknown"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>

              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {summary.map(([emoji, { count, reactedByMe }]) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(message.id, emoji)}
                    disabled={!canReact}
                    className={`text-xs rounded-full border px-1.5 py-0.5 ${
                      reactedByMe
                        ? "border-acacia-gold bg-acacia-gold/20"
                        : "border-surface-border"
                    } disabled:opacity-50`}
                  >
                    {emoji} {count}
                  </button>
                ))}

                {canReact && (
                  <div className="group relative inline-block">
                    <button className="text-xs rounded-full border border-surface-border px-1.5 py-0.5 text-muted-foreground">
                      +
                    </button>
                    <div className="hidden group-hover:flex absolute z-10 bg-surface border border-surface-border rounded-full shadow-sm px-1 py-0.5 gap-0.5 top-full mt-1">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReact(message.id, emoji)}
                          className="hover:scale-125 transition-transform px-0.5"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {canChat ? (
        <form onSubmit={handleSend} className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message the chapter…"
            className="flex-1 rounded-md border border-surface-border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-acacia-gold text-acacia-black px-4 py-2 text-sm font-semibold"
          >
            Send
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground border border-surface-border rounded-md px-3 py-2">
          You don&apos;t currently have permission to send messages. Ask an admin
          if you think this is wrong.
        </p>
      )}
    </div>
  );
}
