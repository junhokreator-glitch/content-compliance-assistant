import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthedUser, createClient } from "@/app/lib/supabase/server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // 미들웨어가 1차로 막지만, 여기서도 다시 확인한다(설정 실수로 미들웨어가 우회되는 경우를 대비한 2차 방어).
  const user = await getAuthedUser();
  if (!user) redirect("/login");

  async function logout() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div>
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="font-medium hover:underline">
              검수
            </Link>
            <Link href="/cases" className="font-medium hover:underline">
              사례 관리
            </Link>
            {user.role === "admin" && (
              <Link href="/admin/history" className="font-medium hover:underline">
                변경 이력
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <span>{user.email}</span>
            <form action={logout}>
              <button type="submit" className="underline hover:text-neutral-800 dark:hover:text-neutral-300">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
