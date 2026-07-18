import { redirect } from "next/navigation";
import { isAdminAuthed, adminConfigured } from "@/lib/admin-auth";
import { AdminLoginForm } from "@/components/AdminLoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Login" };

export default async function AdminLoginPage() {
  if (await isAdminAuthed()) redirect("/admin");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">Admin sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Restricted area — manage colleges, alumni, placements and cutoffs.
        </p>
        {!adminConfigured ? (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            Admin account isn&rsquo;t configured. Set <code>ADMIN_USERNAME</code>,{" "}
            <code>ADMIN_PASSWORD</code> and <code>ADMIN_SESSION_SECRET</code> in{" "}
            <code>.env.local</code>, then restart.
          </div>
        ) : (
          <AdminLoginForm />
        )}
      </div>
    </div>
  );
}
