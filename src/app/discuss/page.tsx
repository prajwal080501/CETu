import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { getThreads, getScopeOptions } from "@/lib/discuss";
import { ScopeFilter } from "@/components/discuss/ScopeFilter";
import { NewThreadForm } from "@/components/discuss/NewThreadForm";
import { clerkEnabled } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Discussions",
  description:
    "Branch-wise, city-wise and general discussion threads for MHT-CET aspirants — ask questions and share admission experiences.",
};

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const SCOPE_LABEL = (t: string, v: string) =>
  t === "general" ? "General" : v;

export default async function DiscussPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; value?: string }>;
}) {
  const sp = await searchParams;
  const scopeType = sp.scope ?? "";
  const scopeValue = sp.value ?? "";

  const [threads, options] = await Promise.all([
    getThreads({
      scopeType: scopeType || undefined,
      scopeValue: scopeValue || undefined,
    }),
    getScopeOptions(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Discussions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Branch-wise, city-wise and general threads. Ask questions, compare notes,
        share your CAP experience.
      </p>

      <div className="mt-6 space-y-4">
        <ScopeFilter
          scopeType={scopeType}
          scopeValue={scopeValue}
          branches={options.branches}
          cities={options.cities}
        />
        <NewThreadForm
          branches={options.branches}
          cities={options.cities}
          defaultScopeType={scopeType || "general"}
          defaultScopeValue={scopeValue}
          clerkOn={clerkEnabled}
        />
      </div>

      <div className="mt-8">
        {threads.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            No threads yet{scopeValue ? ` for ${scopeValue}` : ""}. Be the first to
            start one.
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/discuss/${t.id}`}
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {SCOPE_LABEL(t.scopeType, t.scopeValue)}
                      </Badge>
                      <span className="truncate font-medium">{t.title}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t.authorName ?? "Student"} · {timeAgo(t.createdAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    {t.replyCount}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
