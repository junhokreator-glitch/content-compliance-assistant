import { redirect } from "next/navigation";
import { getAuthedUser } from "@/app/lib/supabase/server";
import { 변경이력목록읽기, type 변경이력 } from "@/app/lib/case-store";

const 액션라벨: Record<변경이력["action"], string> = {
  insert: "추가",
  update: "수정",
  delete: "삭제",
};

const 액션색상: Record<변경이력["action"], string> = {
  insert: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  update: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default async function AdminHistoryPage() {
  // 미들웨어가 role을 확인해 이미 막지만, 여기서도 다시 확인한다(2차 방어).
  const user = await getAuthedUser();
  if (!user || user.role !== "admin") redirect("/");

  const 이력목록 = await 변경이력목록읽기();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-bold">사례 변경 이력</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        사례를 누가, 언제, 어떻게 추가·수정·삭제했는지의 기록입니다. 최근 200건까지 보여줍니다.
      </p>

      <ul className="mt-8 space-y-3">
        {이력목록.map((이력) => (
          <li
            key={이력.id}
            className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${액션색상[이력.action]}`}
              >
                {액션라벨[이력.action]}
              </span>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {이력.actor_email}
              </span>
              <span className="text-sm text-neutral-400">
                {new Date(이력.created_at).toLocaleString("ko-KR")}
              </span>
            </div>

            {이력.action !== "insert" && 이력.이전값 && (
              <p className="mt-3 text-sm">
                <span className="font-medium">이전: </span>
                <span className="text-neutral-600 dark:text-neutral-400">
                  “{이력.이전값.문구}” ({이력.이전값.등급})
                </span>
              </p>
            )}
            {이력.action !== "delete" && 이후값있음(이력) && (
              <p className="mt-1 text-sm">
                <span className="font-medium">이후: </span>
                <span className="text-neutral-600 dark:text-neutral-400">
                  “{이력.이후값!.문구}” ({이력.이후값!.등급})
                </span>
              </p>
            )}
          </li>
        ))}

        {이력목록.length === 0 && (
          <p className="text-sm text-neutral-500">아직 변경 이력이 없습니다.</p>
        )}
      </ul>
    </main>
  );
}

function 이후값있음(이력: 변경이력): 이력 is 변경이력 & { 이후값: NonNullable<변경이력["이후값"]> } {
  return 이력.이후값 !== null;
}
