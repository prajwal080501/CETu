"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { createReply } from "@/app/actions/discuss";

export function ReplyForm({
  threadId,
  clerkOn,
}: {
  threadId: number;
  clerkOn: boolean;
}) {
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!clerkOn || !isSignedIn)
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Sign in to reply to this thread.
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await createReply({
      threadId,
      body,
      authorName: user?.firstName ?? user?.username ?? "Student",
    });
    setBusy(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    } else setErr(res.error);
  }

  return (
    <form onSubmit={submit} className="rounded-xl border p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply…"
        className="min-h-20 w-full rounded-lg border bg-transparent p-3 text-sm outline-none focus:border-ring"
        required
      />
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Posting…" : "Reply"}
        </Button>
        {err && <span className="text-sm text-destructive">{err}</span>}
      </div>
    </form>
  );
}
