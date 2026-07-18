"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createThread } from "@/app/actions/discuss";

export function NewThreadForm({
  branches,
  cities,
  defaultScopeType,
  defaultScopeValue,
  clerkOn,
}: {
  branches: string[];
  cities: string[];
  defaultScopeType: string;
  defaultScopeValue: string;
  clerkOn: boolean;
}) {
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const [open, setOpen] = useState(false);
  const [scopeType, setScopeType] = useState(
    defaultScopeType === "branch" || defaultScopeType === "city"
      ? defaultScopeType
      : "general"
  );
  const [scopeValue, setScopeValue] = useState(defaultScopeValue || "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!clerkOn) return null;
  if (!isSignedIn)
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Sign in to start a discussion.
      </div>
    );

  if (!open)
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <MessageSquarePlus className="h-4 w-4" /> Start a thread
      </Button>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await createThread({
      scopeType,
      scopeValue: scopeType === "general" ? "" : scopeValue,
      title,
      body,
      authorName: user?.firstName ?? user?.username ?? "Student",
    });
    setBusy(false);
    if (res.ok) router.push(`/discuss/${res.id}`);
    else setErr(res.error);
  }

  const options = scopeType === "branch" ? branches : scopeType === "city" ? cities : [];

  return (
    <form onSubmit={submit} className="rounded-xl border p-4">
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Topic</Label>
          <Select value={scopeType} onValueChange={(v) => { setScopeType(v ?? "general"); setScopeValue(""); }}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="branch">By branch</SelectItem>
              <SelectItem value="city">By city / location</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {scopeType !== "general" && (
          <div className="grid gap-1.5">
            <Label>{scopeType === "branch" ? "Branch" : "City / location"}</Label>
            <Select value={scopeValue} onValueChange={(v) => setScopeValue(v ?? "")}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={`Choose a ${scopeType}`} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {options.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Thread title"
        className="mb-2 h-10"
        required
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Ask a question or share your experience…"
        className="min-h-24 w-full rounded-lg border bg-transparent p-3 text-sm outline-none focus:border-ring"
        required
      />
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" disabled={busy || (scopeType !== "general" && !scopeValue)}>
          {busy ? "Posting…" : "Post thread"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {err && <span className="text-sm text-destructive">{err}</span>}
      </div>
    </form>
  );
}
