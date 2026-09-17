import { createClient } from "@/lib/supabase/server";
import { ChatRoom } from "@/components/chat-room";
import type { Profile } from "@/lib/types";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: profiles }, { data: messages }, { data: reactions }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
      supabase.from("profiles").select("id, full_name"),
      supabase
        .from("messages")
        .select("id, user_id, content, created_at")
        .order("created_at", { ascending: true })
        .limit(200),
      supabase.from("message_reactions").select("id, message_id, user_id, emoji"),
    ]);

  return (
    <ChatRoom
      currentUserId={user!.id}
      canChat={profile?.can_chat ?? false}
      canReact={profile?.can_react ?? false}
      profiles={profiles ?? []}
      initialMessages={messages ?? []}
      initialReactions={reactions ?? []}
    />
  );
}
