"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/app/lib/supabase/server";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    // "Before User Created" 훅이 거부하면 여기 error.message에 그 사유가 담겨 온다.
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/signup?sent=1");
}
