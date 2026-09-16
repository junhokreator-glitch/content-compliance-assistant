import Link from "next/link";
import { verifySignupOtp, resendSignupOtp } from "../actions";

export default async function VerifySignupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string; resent?: string }>;
}) {
  const { email, error, resent } = await searchParams;

  if (!email) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          잘못된 접근입니다.{" "}
          <Link href="/signup" className="underline">
            회원가입으로 돌아가기
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5">
      <h1 className="text-xl font-bold">이메일 인증</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        <strong>{email}</strong>(으)로 보낸 6자리 인증번호를 입력해 주세요.
      </p>

      {resent && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          인증번호를 다시 보냈습니다.
        </p>
      )}

      <form action={verifySignupOtp} className="mt-8 space-y-4">
        <input type="hidden" name="email" value={email} />

        <div>
          <label htmlFor="token" className="block text-sm font-medium">
            인증번호
          </label>
          <input
            id="token"
            name="token"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            placeholder="123456"
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-center text-lg tracking-[0.5em] outline-none focus:border-neutral-500 dark:border-neutral-700"
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
          인증하고 가입 완료
        </button>
      </form>

      <form action={resendSignupOtp} className="mt-4">
        <input type="hidden" name="email" value={email} />
        <button type="submit" className="w-full text-center text-sm text-neutral-500 underline">
          인증번호 다시 받기
        </button>
      </form>
    </main>
  );
}
