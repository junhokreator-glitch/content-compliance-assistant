import Link from "next/link";
import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5">
      <h1 className="text-xl font-bold">회원가입</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        회사 이메일(@jeisys.com)로만 가입할 수 있습니다.
      </p>

      {sent ? (
        <p className="mt-8 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          확인 메일을 보냈습니다. 메일함에서 링크를 클릭해 가입을 완료해 주세요.
        </p>
      ) : (
        <form action={signup} className="mt-8 space-y-4">
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
              minLength={6}
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
            가입하기
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-neutral-500">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="underline">
          로그인
        </Link>
      </p>
    </main>
  );
}
