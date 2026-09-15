// 서버(Server Component, Server Action, Route Handler)에서 쓰는 Supabase 클라이언트
// 로그인 세션(쿠키) 기준으로 동작한다. cases 테이블 접근용 관리자 클라이언트(app/lib/case-store.ts)와는 별개다.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서 호출되면 쿠키를 쓸 수 없어 여기로 온다.
            // 세션 갱신은 middleware.ts가 담당하므로 무시해도 된다.
          }
        },
      },
    },
  );
}

export type 인증사용자 = { email: string; role: "user" | "admin" };

// JWT 서명까지 검증하는 안전한 방식으로 로그인 사용자를 확인한다 (getSession()은 신뢰하지 않는다).
export async function getAuthedUser(): Promise<인증사용자 | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;

  const claims = data.claims as { email?: string; app_metadata?: { role?: string } };
  if (!claims.email) return null;

  return {
    email: claims.email,
    role: claims.app_metadata?.role === "admin" ? "admin" : "user",
  };
}
