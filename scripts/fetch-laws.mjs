// 법제처 국가법령정보 OPEN API에서 의료기기 광고 관련 규정을 수집해 data/laws.json에 저장한다.
// 실행: npm run fetch-laws

import { writeFile, mkdir } from "node:fs/promises";

const OC = process.env.LAW_API_OC;
const BASE = "https://www.law.go.kr/DRF";

// 수집 대상 법령
// 같은 조문번호를 쓰는 가지조문(제45조의2 등)이 섞이지 않도록 조문제목으로 함께 특정한다.
const 법령_대상 = [
  { 법령명: "의료기기법", 조문: [{ 번호: "24", 제목: "기재 및 광고의 금지" }] },
  {
    법령명: "의료기기법 시행규칙",
    조문: [{ 번호: "45", 제목: "의료기기광고의 범위" }],
    별표키워드: "금지되는 광고",
  },
];

// 수집 대상 행정규칙(식약처 고시)
const 행정규칙_대상 = ["의료기기 표시·기재 등에 관한 규정"];

async function 호출(경로, params) {
  const url = new URL(`${BASE}/${경로}`);
  url.searchParams.set("OC", OC);
  url.searchParams.set("type", "JSON");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`API 호출 실패 (${response.status})`);
  return response.json();
}

// 응답에서 배열/단일 객체를 모두 배열로 맞춘다.
const 배열화 = (value) => (Array.isArray(value) ? value : value ? [value] : []);

// 조문 하나를 사람이 읽는 텍스트로 변환한다.
function 조문텍스트(조) {
  const lines = [조.조문내용?.trim()].filter(Boolean);
  for (const 항 of 배열화(조.항)) {
    if (항.항내용) lines.push(항.항내용.trim());
    for (const 호 of 배열화(항.호)) {
      if (호.호내용) lines.push(`  ${호.호내용.trim()}`);
      for (const 목 of 배열화(호.목)) {
        if (목.목내용) lines.push(`    ${String(목.목내용).trim()}`);
      }
    }
  }
  return lines.join("\n");
}

// 별표 내용(중첩 배열)을 텍스트로 변환한다.
function 별표텍스트(별표) {
  return 배열화(별표.별표내용)
    .flat(Infinity)
    .map((line) => String(line).trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function 법령수집({ 법령명, 조문: 조문목록, 별표키워드 }) {
  const 검색 = await 호출("lawSearch.do", { target: "law", query: 법령명, display: "20" });
  const 후보 = 배열화(검색.LawSearch?.law).find((a) => a.법령명한글 === 법령명);
  if (!후보) throw new Error(`법령을 찾지 못했습니다: ${법령명}`);

  const 본문 = await 호출("lawService.do", { target: "law", MST: 후보.법령일련번호 });
  const 시행일자 = 본문.법령?.기본정보?.시행일자;
  const 결과 = [];

  for (const 조 of 배열화(본문.법령?.조문?.조문단위)) {
    const 일치 = 조문목록.find(
      (대상) => 대상.번호 === String(조.조문번호) && String(조.조문제목).includes(대상.제목),
    );
    if (!일치) continue;
    결과.push({
      출처: `${법령명} 제${조.조문번호}조(${조.조문제목})`,
      시행일자,
      내용: 조문텍스트(조),
    });
  }

  if (별표키워드) {
    for (const 별표 of 배열화(본문.법령?.별표?.별표단위)) {
      if (!String(별표.별표제목).includes(별표키워드)) continue;
      결과.push({
        출처: `${법령명} 별표 ${Number(별표.별표번호)} (${별표.별표제목})`,
        시행일자,
        내용: 별표텍스트(별표),
      });
    }
  }

  return 결과;
}

async function 행정규칙수집(규칙명) {
  const 검색 = await 호출("lawSearch.do", { target: "admrul", query: "의료기기", display: "100" });
  const 후보 = 배열화(검색.AdmRulSearch?.admrul).find((a) =>
    String(a.행정규칙명).replace(/\s/g, "").includes(규칙명.replace(/\s/g, "")),
  );
  if (!후보) throw new Error(`행정규칙을 찾지 못했습니다: ${규칙명}`);

  const 본문 = await 호출("lawService.do", { target: "admrul", ID: 후보.행정규칙일련번호 });
  const 기본 = 본문.AdmRulService ?? 본문;
  const 조문들 = 배열화(기본.조문내용 ?? 기본.조문?.조문단위);

  const 내용 = 조문들
    .map((조) => (typeof 조 === "string" ? 조 : 조문텍스트(조)))
    .join("\n")
    .trim();

  return [{ 출처: `${규칙명}(식품의약품안전처 고시)`, 시행일자: 후보.시행일자, 내용 }];
}

async function main() {
  if (!OC) throw new Error("LAW_API_OC 환경변수가 없습니다. .env 파일을 확인하세요.");

  const 규정 = [];
  for (const 대상 of 법령_대상) 규정.push(...(await 법령수집(대상)));
  for (const 규칙명 of 행정규칙_대상) {
    try {
      규정.push(...(await 행정규칙수집(규칙명)));
    } catch (error) {
      // 고시는 보조 자료이므로 실패해도 법령 수집 결과는 저장한다.
      console.warn(`건너뜀 - ${error.message}`);
    }
  }

  await mkdir("data", { recursive: true });
  await writeFile(
    "data/laws.json",
    JSON.stringify({ 수집일시: new Date().toISOString(), 규정 }, null, 2),
    "utf-8",
  );

  console.log(`수집 완료: ${규정.length}건`);
  for (const r of 규정) {
    console.log(` - ${r.출처} (시행 ${r.시행일자}, ${r.내용.length}자)`);
  }
}

main();
