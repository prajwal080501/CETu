import Link from "next/link";
import {
  MessageSquare,
  MessagesSquare,
  GraduationCap,
  MapPin,
  Globe,
} from "lucide-react";
import { getThreads, getScopeOptions } from "@/lib/discuss";
import { ScopeFilter } from "@/components/discuss/ScopeFilter";
import { NewThreadForm } from "@/components/discuss/NewThreadForm";
import { clerkEnabled } from "@/lib/auth";

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

function initials(name: string | null) {
  if (!name?.trim()) return "S";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

type ScopeKey = "branch" | "city" | "general";
const SCOPE: Record<
  ScopeKey,
  { Icon: typeof Globe; label: (v: string) => string; badge: string; ring: string }
> = {
  branch: {
    Icon: GraduationCap,
    label: (v) => v,
    badge: "border-primary/30 bg-primary/10 text-primary",
    ring: "from-primary to-chart-2",
  },
  city: {
    Icon: MapPin,
    label: (v) => v,
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    ring: "from-amber-500 to-orange-500",
  },
  general: {
    Icon: Globe,
    label: () => "General",
    badge: "border-border bg-muted text-muted-foreground",
    ring: "from-slate-400 to-slate-500",
  },
};

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
      {/* Hero */}
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-chart-2 text-primary-foreground shadow-sm">
          <MessagesSquare className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Discussions</h1>
          <p className="text-sm text-muted-foreground">
            Ask questions, compare notes, and share your CAP experience.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/50 p-3 sm:flex-row sm:items-center sm:justify-between">
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

      {/* List header */}
      <div className="mb-3 mt-7">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {threads.length} {threads.length === 1 ? "thread" : "threads"}
          {scopeValue ? ` · ${scopeValue}` : ""}
        </span>
      </div>

      {threads.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-14 text-center">
          <MessagesSquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">
            No threads yet{scopeValue ? ` for ${scopeValue}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to start the conversation.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {threads.map((t) => {
            const s = SCOPE[t.scopeType as ScopeKey] ?? SCOPE.general;
            return (
              <li key={t.id}>
                <Link
                  href={`/discuss/${t.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br ${s.ring} text-sm font-bold text-white`}
                  >
                    {initials(t.authorName)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <span
                      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.badge}`}
                    >
                      <s.Icon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{s.label(t.scopeValue)}</span>
                    </span>
                    <h3 className="mt-1 truncate font-semibold transition-colors group-hover:text-primary">
                      {t.title}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {t.authorName ?? "Student"} · started {timeAgo(t.createdAt)}
                      {t.replyCount > 0 ? ` · active ${timeAgo(t.lastActivityAt)}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-center rounded-xl bg-muted/60 px-3 py-1.5 text-center transition-colors group-hover:bg-primary/10">
                    <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {t.replyCount}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      repl{t.replyCount === 1 ? "y" : "ies"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
