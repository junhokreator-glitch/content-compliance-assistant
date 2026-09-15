import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5">
      <h1 className="text-xl font-bold">로그인</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        콘텐츠 컴플라이언스 검수 어시스턴트
      </p>

      <form action={login} className="mt-8 space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo ?? "/"} />

        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@jeisys.com"
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-neutral-900"
        >
          로그인
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="underline">
          회원가입
        </Link>
      </p>
    </main>
  );
}
