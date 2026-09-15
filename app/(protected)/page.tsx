"use client";

import { useState } from "react";

type 등급 = "SAFE" | "CONDITIONAL" | "HIGH RISK";

// 검수 결과 한 건
type Finding = {
  excerpt: string;
  category: string;
  verdict: Exclude<등급, "SAFE">;
  reason: string;
  basis: string;
  suggestions: string[];
};

// 등급별 배지 색상
const 등급색상: Record<등급, string> = {
  "HIGH RISK": "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  CONDITIONAL: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  SAFE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

const 등급설명: Record<등급, string> = {
  "HIGH RISK": "법무·컴플라이언스 확인이 필요합니다.",
  CONDITIONAL: "아래 조치를 반영하면 진행할 수 있습니다.",
  SAFE: "발견된 리스크가 없습니다.",
};

// 검수에 사용된 규정 정보
type 기준규정 = { 출처: string; 시행일자: string };

const MAX_LENGTH = 5000;

// 이 두 영역만 "문구 대체"이고, 나머지(콘텐츠 권리·동의, 환자 정보)는 본문에 끼워 넣을 문구가 아니라 조치 안내다.
const 텍스트치환영역 = new Set(["마케팅 표현", "의료기기 광고"]);

export default function Home() {
  const [content, setContent] = useState("");
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [overallRisk, setOverallRisk] = useState<등급>("SAFE");
  const [revisedContent, setRevisedContent] = useState("");
  const [기준규정, set기준규정] = useState<기준규정[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [복사완료, set복사완료] = useState(false);

  async function handleReview() {
    setIsLoading(true);
    setError("");
    setFindings(null);
    set복사완료(false);

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "검수 중 문제가 발생했습니다.");
        return;
      }
      setFindings(data.findings);
      setOverallRisk(data.overallRisk ?? "SAFE");
      setRevisedContent(data.revisedContent ?? content);
      set기준규정(data.기준규정 ?? []);
    } catch {
      setError("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  async function 수정본복사하기() {
    try {
      await navigator.clipboard.writeText(revisedContent);
      set복사완료(true);
      setTimeout(() => set복사완료(false), 2000);
    } catch {
      setError("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
    }
  }

  const 텍스트치환건 = findings?.filter((f) => 텍스트치환영역.has(f.category)) ?? [];
  const 별도조치건 = findings?.filter((f) => !텍스트치환영역.has(f.category)) ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-bold">콘텐츠 컴플라이언스 검수 어시스턴트</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        마케팅 콘텐츠의 법무·컴플라이언스 리스크를 사전에 확인하고 대체 표현을 제안합니다.
      </p>

      <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        실명·연락처 등 개인정보가 포함된 콘텐츠는 입력하지 마세요.
      </p>

      <label htmlFor="content" className="mt-8 block text-sm font-medium">
        검수할 콘텐츠
      </label>
      <textarea
        id="content"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={MAX_LENGTH}
        rows={10}
        placeholder="광고 문구, SNS 게시글, 제품 소개 자료 등을 붙여넣으세요. (한국어/영어 모두 가능)"
        className="mt-2 w-full resize-y rounded-lg border border-neutral-300 bg-transparent p-3 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
      />

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-neutral-500">
          {content.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}자
        </span>
        <button
          onClick={handleReview}
          disabled={isLoading || content.trim().length === 0}
          className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          {isLoading ? "검수 중..." : "검수하기"}
        </button>
      </div>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {findings !== null && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">
            검수 결과{" "}
            <span className="text-neutral-500">
              {findings.length > 0 ? `${findings.length}건` : ""}
            </span>
          </h2>

          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            이 결과는 <strong>한국 의료기기법 기준</strong>입니다. 해외(미국·유럽 등)에 게시할 콘텐츠라면
            해당 국가의 광고 규정도 별도로 확인해야 합니다.
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${등급색상[overallRisk]}`}
              >
                {overallRisk}
              </span>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {등급설명[overallRisk]}
              </span>
            </div>

            {텍스트치환건.length > 0 && (
              <button
                onClick={수정본복사하기}
                className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                {복사완료 ? "복사됨 ✓" : "수정본 복사"}
              </button>
            )}
          </div>

          {별도조치건.length > 0 && (
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              콘텐츠 권리·동의, 환자 정보 관련 {별도조치건.length}건은 문구 수정이 아니라 별도 조치가
              필요해 수정본에 포함되지 않습니다. 아래 항목에서 직접 확인해 주세요.
            </p>
          )}

          {텍스트치환건.length > 0 && (
            <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm whitespace-pre-wrap dark:border-neutral-800 dark:bg-neutral-900">
              {revisedContent}
            </div>
          )}

          {findings.length > 0 && (
            <ul className="mt-4 space-y-4">
              {findings.map((finding, index) => (
                <li
                  key={index}
                  className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${등급색상[finding.verdict]}`}
                    >
                      {finding.verdict}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
                      {finding.category}
                    </span>
                  </div>

                  <p className="mt-3 border-l-2 border-neutral-300 pl-3 text-sm font-medium dark:border-neutral-700">
                    “{finding.excerpt}”
                  </p>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div>
                      <dt className="inline font-medium">사유: </dt>
                      <dd className="inline text-neutral-700 dark:text-neutral-300">
                        {finding.reason}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">근거: </dt>
                      <dd className="inline text-neutral-700 dark:text-neutral-300">
                        {finding.basis}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-4 text-sm font-medium">대체 표현 / 필요한 조치</p>
                  <ul className="mt-2 space-y-1.5">
                    {finding.suggestions.map((suggestion, suggestionIndex) => (
                      <li
                        key={suggestionIndex}
                        className="rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900"
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {기준규정.length > 0 && (
        <details className="mt-10 text-xs text-neutral-500">
          <summary className="cursor-pointer">검수 기준 규정 {기준규정.length}건</summary>
          <ul className="mt-2 space-y-1">
            {기준규정.map((규정) => (
              <li key={규정.출처}>
                {규정.출처} (시행 {규정.시행일자})
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-12 text-xs text-neutral-500">
        검수 결과는 참고용입니다. 콘텐츠 게시 여부와 그에 대한 책임은 담당자에게 있습니다.
      </p>
    </main>
  );
}
