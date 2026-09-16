// 모든 요청에서 Supabase 로그인 세션을 갱신하고, 로그인/역할에 따라 접근을 제어한다.

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// 로그인 없이 접근 가능한 경로
const PUBLIC_PATHS = ["/login", "/signup", "/auth"];
const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

// 회원가입은 @jeisys.com만 허용하지만(Before User Created 훅 + auth/confirm 재확인),
// 그 방어를 어떤 이유로든 우회해 세션이 생긴 경우를 대비해 모든 요청에서 한 번 더 확인한다.
const ALLOWED_EMAIL_DOMAIN = "jeisys.com";
const hasAllowedDomain = (email?: string) =>
  !!email && email.toLowerCase().split("@")[1] === ALLOWED_EMAIL_DOMAIN;

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // 토큰이 갱신되면 요청·응답 쿠키를 모두 새로 반영해야 다음 단계에서 최신 세션을 본다.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as { email?: string; app_metadata?: { role?: string } } | undefined;
  const isAuthed = !error && !!claims?.email;
  const role = claims?.app_metadata?.role === "admin" ? "admin" : "user";
  const { pathname } = request.nextUrl;

  if (isAuthed && !hasAllowedDomain(claims?.email)) {
    await supabase.auth.signOut();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "회사 이메일(@jeisys.com) 계정만 사용할 수 있습니다." },
        { status: 403 },
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "회사 이메일(@jeisys.com) 계정만 사용할 수 있습니다.");
    return NextResponse.redirect(loginUrl);
  }

  if (!isAuthed && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthed && pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
