"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  file_path: string | null;
  file_name: string | null;
  pending?: boolean;
}

interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀"];
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function ChatRoom({
  channel,
  currentUserId,
  canPost,
  postBlockedReason,
  canReact,
  canAttach,
  profiles,
  initialMessages,
  initialReactions,
}: {
  channel: "all" | "active" | "exec" | "pledge";
  currentUserId: string;
  canPost: boolean;
  postBlockedReason: string;
  canReact: boolean;
  canAttach: boolean;
  profiles: {
    id: string;
    full_name: string;
    is_pledge: boolean;
    is_exec: boolean;
    role: string;
  }[];
  initialMessages: ChatMessage[];
  initialReactions: ChatReaction[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [reactions, setReactions] = useState<ChatReaction[]>(initialReactions);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tagById = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((p) => {
      if (p.is_pledge) map.set(p.id, "Pledge");
      else if (p.is_exec || p.role === "admin") map.set(p.id, "Exec");
    });
    return map;
  }, [profiles]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((p) => map.set(p.id, p.full_name || "Unnamed"));
    return map;
  }, [profiles]);

  useEffect(() => {
    const realtimeChannel = supabase
      .channel(`chat-room-${channel}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel=eq.${channel}` },
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
      supabase.removeChannel(realtimeChannel);
    };
  }, [supabase, channel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if ((!content && !file) || sending) return;

    setError(null);
    setSending(true);

    let filePath: string | null = null;
    if (file) {
      if (file.size > MAX_FILE_BYTES) {
        setError("That file is over 20 MB.");
        setSending(false);
        return;
      }
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      filePath = `${currentUserId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("chat-files")
        .upload(filePath, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) {
        setError(uploadError.message);
        setSending(false);
        return;
      }
    }

    const attached = file;
    setDraft("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        user_id: currentUserId,
        content,
        created_at: new Date().toISOString(),
        file_path: filePath,
        file_name: attached?.name ?? null,
        pending: true,
      },
    ]);

    const { error } = await supabase.rpc("send_message", {
      p_content: content,
      p_channel: channel,
      p_file_path: filePath,
      p_file_name: attached?.name ?? null,
    });
    setSending(false);
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(error.message);
    }
  }

  async function openFile(path: string) {
    const { data, error } = await supabase.storage
      .from("chat-files")
      .createSignedUrl(path, 300);
    if (error || !data) {
      setError(error?.message ?? "Couldn't open that file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
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
    const byEmoji = new Map<
      string,
      { count: number; reactedByMe: boolean; names: string[] }
    >();
    for (const r of forMessage) {
      const entry = byEmoji.get(r.emoji) ?? { count: 0, reactedByMe: false, names: [] };
      entry.count += 1;
      entry.names.push(nameById.get(r.user_id) ?? "Unknown");
      if (r.user_id === currentUserId) entry.reactedByMe = true;
      byEmoji.set(r.emoji, entry);
    }
    return Array.from(byEmoji.entries());
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No messages yet.
          </p>
        )}

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
                    {tagById.get(message.user_id) && (
                      <span className="ml-1.5 rounded bg-acacia-black/10 px-1 text-[10px] font-medium uppercase tracking-wide text-acacia-black">
                        {tagById.get(message.user_id)}
                      </span>
                    )}
                  </p>
                )}
                {message.content && (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
                {message.file_path && (
                  <button
                    onClick={() => openFile(message.file_path!)}
                    className="mt-1 flex items-center gap-1.5 rounded-md border border-current/30 px-2 py-1 text-xs underline-offset-2 hover:underline"
                  >
                    <span aria-hidden>📎</span>
                    <span className="truncate max-w-56">
                      {message.file_name ?? "Attachment"}
                    </span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {summary.map(([emoji, { count, reactedByMe, names }]) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(message.id, emoji)}
                    disabled={!canReact}
                    title={names.join(", ")}
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

      {canPost ? (
        <form onSubmit={handleSend} className="mt-3 flex gap-2 items-center">
          {canAttach && <label
            className="cursor-pointer rounded-md border border-surface-border px-2.5 py-2 text-sm"
            title="Attach a document"
          >
            📎
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>}
          <div className="flex-1 min-w-0">
            {file && (
              <p className="text-xs text-muted truncate mb-1">
                Attached: {file.name}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="underline"
                >
                  remove
                </button>
              </p>
            )}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                channel === "exec"
                  ? "Message the exec…"
                  : channel === "pledge"
                    ? "Message the pledge chat…"
                    : channel === "active"
                      ? "Message the actives…"
                      : "Message everyone…"
              }
              className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="rounded-md bg-acacia-gold text-acacia-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground border border-surface-border rounded-md px-3 py-2">
          {postBlockedReason}
        </p>
      )}
    </>
  );
}
