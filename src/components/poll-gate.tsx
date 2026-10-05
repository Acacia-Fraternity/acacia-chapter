"use client";

import { useRouter } from "next/navigation";
import { PollVoteForm } from "@/components/poll-vote-form";

// Rendered by the dashboard layout in place of the whole app while a required
// poll is unanswered. It has no links or close button on purpose; submitting
// refreshes the layout, which swaps in the next poll or the app itself.
export function PollGate({
  poll,
  remaining,
}: {
  poll: { id: string; question: string; options: string[]; allowMultiple: boolean };
  remaining: number;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-surface-border bg-surface p-6 shadow-lg">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Answer to continue{remaining > 1 ? ` · ${remaining} polls` : ""}
        </p>
        <h1 className="text-lg font-semibold">{poll.question}</h1>
        <PollVoteForm
          key={poll.id}
          pollId={poll.id}
          options={poll.options}
          allowMultiple={poll.allowMultiple}
          onDone={() => router.refresh()}
        />
      </div>
    </div>
  );
}
