"use server";

import { redirect } from "next/navigation";
import {
  verifyCredentials,
  createAdminSession,
  clearAdminSession,
} from "@/lib/admin-auth";

export async function adminLogin(_prev: unknown, formData: FormData) {
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  if (!verifyCredentials(username, password)) {
    return { error: "Invalid username or password." };
  }
  await createAdminSession();
  redirect("/admin");
}

export async function adminLogout() {
  await clearAdminSession();
  redirect("/admin/login");
}
