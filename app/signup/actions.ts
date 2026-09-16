"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";

const ALLOWED_EMAIL_DOMAIN = "jeisys.com";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // "Before User Created" 훅이 거부하면 여기 error.message에 그 사유가 담겨 온다.
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/signup/verify?email=${encodeURIComponent(email)}`);
}

// 가입 메일로 받은 6자리 인증번호를 확인해 가입을 완료한다.
export async function verifySignupOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const token = String(formData.get("token") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });

  if (error) {
    redirect(
      `/signup/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(error.message)}`,
    );
  }

  // "Before User Created" 훅이 가입 시점에 도메인을 거르지만, 훅이 대시보드에 연결되지
  // 않았거나 다른 이유로 우회된 계정이 있을 수 있으므로 세션이 실제로 생기는 이 시점에도
  // 도메인을 한 번 더 확인한다(app/auth/confirm/route.ts와 동일한 2중 방어).
  const domain = data.user?.email?.split("@")[1]?.toLowerCase();
  if (domain !== ALLOWED_EMAIL_DOMAIN) {
    await supabase.auth.signOut();
    if (data.user) await createAdminClient().auth.admin.deleteUser(data.user.id);
    redirect(
      `/login?error=${encodeURIComponent("회사 이메일(@jeisys.com)로만 가입할 수 있습니다.")}`,
    );
  }

  redirect("/");
}

// 인증 메일을 다시 보낸다.
export async function resendSignupOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });

  if (error) {
    redirect(
      `/signup/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(error.message)}`,
    );
  }

  redirect(`/signup/verify?email=${encodeURIComponent(email)}&resent=1`);
}
