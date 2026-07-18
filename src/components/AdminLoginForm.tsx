"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { adminLogin } from "@/app/actions/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLogin, null);
  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="block text-sm">
        <span className="text-muted-foreground">Username</span>
        <Input name="username" autoComplete="username" required className="mt-1" />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Password</span>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1"
        />
      </label>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="w-full gap-1.5">
        <LogIn className="h-4 w-4" />
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
