// 회원가입 이메일의 확인 링크가 도착하는 콜백. code를 세션으로 교환한다.
//
// 가입 시점에는 "Before User Created" 훅(scripts/sql/restrict-signup-domain.sql)이
// @jeisys.com 외 도메인을 거른다. 하지만 훅이 대시보드에 연결되지 않았거나 다른 이유로
// 우회된 계정이 존재할 수 있으므로, 세션이 실제로 생기는 이 시점에도 도메인을 한 번 더
// 확인한다(2중 방어). 여기서 걸리면 세션을 끊고 계정 자체를 삭제한다.
import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";

const ALLOWED_EMAIL_DOMAIN = "jeisys.com";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const domain = data.user.email?.split("@")[1]?.toLowerCase();

      if (domain !== ALLOWED_EMAIL_DOMAIN) {
        await supabase.auth.signOut();
        await createAdminClient().auth.admin.deleteUser(data.user.id);
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent("회사 이메일(@jeisys.com)로만 가입할 수 있습니다.")}`,
        );
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("이메일 확인 링크가 유효하지 않습니다.")}`,
  );
}
