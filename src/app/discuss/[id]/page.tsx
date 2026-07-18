import Link from "next/link";
import { notFound } from "next/navigation";
import { getThread } from "@/lib/discuss";
import { ReplyForm } from "@/components/discuss/ReplyForm";
import { clerkEnabled } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function when(d: Date) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getThread(Number(id));
  return { title: data ? data.thread.title : "Discussion" };
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getThread(Number(id));
  if (!data) notFound();
  const { thread, replies } = data;
  const scopeHref =
    thread.scopeType === "general"
      ? "/discuss?scope=general"
      : `/discuss?scope=${thread.scopeType}&value=${encodeURIComponent(thread.scopeValue)}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/discuss" className="text-sm text-primary hover:underline">
        ← All discussions
      </Link>

      <article className="mt-4 rounded-2xl border p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Link href={scopeHref}>
            <Badge variant="secondary" className="capitalize">
              {thread.scopeType === "general" ? "General" : thread.scopeValue}
            </Badge>
          </Link>
          <span className="text-xs text-muted-foreground">
            {thread.authorName ?? "Student"} · {when(thread.createdAt)}
          </span>
        </div>
        <h1 className="text-xl font-bold tracking-tight">{thread.title}</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
          {thread.body}
        </p>
      </article>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-muted-foreground">
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </h2>
      <div className="space-y-3">
        {replies.map((r) => (
          <div key={r.id} className="rounded-xl border p-4">
            <div className="mb-1 text-xs text-muted-foreground">
              {r.authorName ?? "Student"} · {when(r.createdAt)}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <ReplyForm threadId={thread.id} clerkOn={clerkEnabled} />
      </div>
    </div>
  );
}
