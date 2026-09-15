"use client";

import { useEffect, useState } from "react";

type 등급 = "HIGH RISK" | "CONDITIONAL";

type 사례입력 = {
  문구: string;
  등급: 등급;
  지적: string;
  수정안: string;
};

type 사례 = 사례입력 & { id: number };

const 등급색상: Record<등급, string> = {
  "HIGH RISK": "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  CONDITIONAL: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
};

const 빈입력: 사례입력 = { 문구: "", 등급: "HIGH RISK", 지적: "", 수정안: "" };

// 문구/등급/지적/수정안 입력 필드 4개를 그리는 공용 폼
function 사례입력폼({
  값,
  변경,
  idPrefix,
}: {
  값: 사례입력;
  변경: (값: 사례입력) => void;
  idPrefix: string;
}) {
  return (
    <>
      <label htmlFor={`${idPrefix}-문구`} className="mt-4 block text-sm font-medium">
        지적받은 문구
      </label>
      <input
        id={`${idPrefix}-문구`}
        value={값.문구}
        onChange={(event) => 변경({ ...값, 문구: event.target.value })}
        placeholder="예: 국내 1위 리프팅 장비"
        className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
      />

      <label htmlFor={`${idPrefix}-등급`} className="mt-4 block text-sm font-medium">
        법무가 매긴 등급
      </label>
      <select
        id={`${idPrefix}-등급`}
        value={값.등급}
        onChange={(event) => 변경({ ...값, 등급: event.target.value as 등급 })}
        className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
      >
        <option value="HIGH RISK">HIGH RISK — 표현 자체를 바꿔야 함</option>
        <option value="CONDITIONAL">CONDITIONAL — 근거를 붙이면 사용 가능</option>
      </select>

      <label htmlFor={`${idPrefix}-지적`} className="mt-4 block text-sm font-medium">
        지적 사유
      </label>
      <input
        id={`${idPrefix}-지적`}
        value={값.지적}
        onChange={(event) => 변경({ ...값, 지적: event.target.value })}
        placeholder="예: 객관적 근거 없는 순위 표현"
        className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
      />

      <label htmlFor={`${idPrefix}-수정안`} className="mt-4 block text-sm font-medium">
        수정안
      </label>
      <input
        id={`${idPrefix}-수정안`}
        value={값.수정안}
        onChange={(event) => 변경({ ...값, 수정안: event.target.value })}
        placeholder="예: 국내 병·의원에서 널리 사용되는 리프팅 장비"
        className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
      />
    </>
  );
}

export default function CasesPage() {
  const [사례목록, set사례목록] = useState<사례[]>([]);
  const [입력, set입력] = useState(빈입력);
  const [수정중id, set수정중id] = useState<number | null>(null);
  const [수정입력, set수정입력] = useState(빈입력);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/cases")
      .then((response) => response.json())
      .then((data) => set사례목록(data.사례 ?? []))
      .catch(() => setError("사례 목록을 불러오지 못했습니다."));
  }, []);

  async function 요청보내기(method: "POST" | "PATCH" | "DELETE", body: unknown) {
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/cases", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "처리 중 문제가 발생했습니다.");
        return false;
      }
      set사례목록(data.사례);
      return true;
    } catch {
      setError("서버에 연결하지 못했습니다.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function 추가하기() {
    if (await 요청보내기("POST", 입력)) set입력(빈입력);
  }

  function 수정시작(사례: 사례) {
    set수정중id(사례.id);
    set수정입력({ 문구: 사례.문구, 등급: 사례.등급, 지적: 사례.지적, 수정안: 사례.수정안 });
    setError("");
  }

  function 수정취소() {
    set수정중id(null);
    setError("");
  }

  async function 수정저장(id: number) {
    if (await 요청보내기("PATCH", { id, ...수정입력 })) set수정중id(null);
  }

  async function 삭제하기(사례: 사례) {
    if (!confirm(`"${사례.문구}" 사례를 삭제할까요?`)) return;
    await 요청보내기("DELETE", { id: 사례.id });
  }

  const 입력완료 = (값: 사례입력) => 값.문구.trim() && 값.지적.trim() && 값.수정안.trim();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-bold">법무 지적 사례 관리</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        법무·컴플라이언스가 지적했던 사례를 등록하면, 검수할 때 등급 판단 기준으로 사용됩니다.
      </p>

      <section className="mt-8 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-base font-semibold">사례 추가</h2>

        <사례입력폼 값={입력} 변경={set입력} idPrefix="new" />

        <button
          onClick={추가하기}
          disabled={isSaving || !입력완료(입력)}
          className="mt-5 rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          {isSaving ? "저장 중..." : "사례 추가"}
        </button>
      </section>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <h2 className="mt-10 text-base font-semibold">
        등록된 사례 <span className="text-neutral-500">{사례목록.length}건</span>
      </h2>

      <ul className="mt-4 space-y-3">
        {사례목록.map((사례) => (
          <li
            key={사례.id}
            className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            {수정중id === 사례.id ? (
              <div>
                <사례입력폼 값={수정입력} 변경={set수정입력} idPrefix={`edit-${사례.id}`} />
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => 수정저장(사례.id)}
                    disabled={isSaving || !입력완료(수정입력)}
                    className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900"
                  >
                    {isSaving ? "저장 중..." : "저장"}
                  </button>
                  <button
                    onClick={수정취소}
                    disabled={isSaving}
                    className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${등급색상[사례.등급]}`}
                  >
                    {사례.등급}
                  </span>
                  <p className="mt-2 text-sm font-medium">“{사례.문구}”</p>
                  <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                    지적: {사례.지적}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    수정안: {사례.수정안}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => 수정시작(사례)}
                    disabled={isSaving}
                    className="rounded-lg px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-900"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => 삭제하기(사례)}
                    disabled={isSaving}
                    className="rounded-lg px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-900"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
