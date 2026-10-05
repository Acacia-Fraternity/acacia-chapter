import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChatRoom } from "@/components/chat-room";
import type { Profile } from "@/lib/types";

type Channel = "all" | "active" | "exec" | "pledge";

const CHANNEL_LABEL: Record<Channel, string> = {
  all: "All members",
  active: "Actives",
  exec: "Exec",
  pledge: "Pledge committee & pledges",
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const { channel: channelParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  const isAdmin = profile?.role === "admin";
  const isPledge = profile?.is_pledge ?? false;
  const isExec = isAdmin || (profile?.is_exec ?? false);
  const onCommittee = isAdmin || (profile?.on_pledge_committee ?? false);

  // Mirrors can_read_channel() in schema.sql — that function is what
  // actually enforces it; this just decides which tabs to show.
  const channels: Channel[] = ["all"];
  if (!isPledge || isAdmin) channels.push("active");
  if (isExec) channels.push("exec");
  if (isPledge || onCommittee) channels.push("pledge");

  const channel: Channel = channels.includes(channelParam as Channel)
    ? (channelParam as Channel)
    : channels[0];

  const [{ data: profiles }, { data: messages }, { data: reactions }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, is_pledge, is_exec, role"),
      supabase
        .from("messages")
        .select("id, user_id, content, created_at, file_path, file_name")
        .eq("channel", channel)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase.from("message_reactions").select("id, message_id, user_id, emoji"),
    ]);

  const canPost = profile?.can_chat ?? false;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h1 className="text-lg font-semibold mr-2">Chat</h1>
        {channels.map((c) => (
          <Link
            key={c}
            href={`/dashboard/chat?channel=${c}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              channel === c
                ? "border-acacia-gold bg-acacia-gold/25"
                : "border-surface-border"
            }`}
          >
            {CHANNEL_LABEL[c]}
          </Link>
        ))}
      </div>

      <ChatRoom
        key={channel}
        channel={channel}
        currentUserId={user!.id}
        canPost={canPost}
        postBlockedReason="You don't currently have permission to send messages. Ask an admin if you think this is wrong."
        canReact={profile?.can_react ?? false}
        profiles={profiles ?? []}
        initialMessages={messages ?? []}
        initialReactions={reactions ?? []}
      />
    </div>
  );
}
