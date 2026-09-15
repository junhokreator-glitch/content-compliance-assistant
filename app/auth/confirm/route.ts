// 회원가입 이메일의 확인 링크가 도착하는 콜백. code를 세션으로 교환한다.

import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("이메일 확인 링크가 유효하지 않습니다.")}`,
  );
}
