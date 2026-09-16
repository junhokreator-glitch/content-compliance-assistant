// data/mfds-ad-review-cases.json(식약처 공공데이터에서 구조화한 181건)을 Supabase cases 테이블에 넣는다.
// 이미 있는 문구는 건너뛴다(unique 제약). 너무 짧거나(맥락 없는 단어) 지시문이 섞인 항목은 제외한다.
//
// 실행: npm run insert-ad-review-cases

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 없습니다.");
const supabase = createClient(url, serviceKey);

const ACTOR_EMAIL = "system@data.go.kr";

// "삭제 또는 ~로 수정" 같은 지시문이 문구 안에 섞여 들어간 경우를 걸러낸다.
const 지시문패턴 = /삭제|수정\(|으로 수정|기재\(|표시\(/;

function 유효한가(사례) {
  if (사례.문구.length < 4) return false; // 맥락 없는 단어 하나짜리 제외
  if (지시문패턴.test(사례.문구)) return false; // 파싱이 지시문까지 문구에 포함시킨 경우 제외
  return true;
}

async function main() {
  const raw = JSON.parse(await readFile("data/mfds-ad-review-cases.json", "utf-8"));
  const 후보 = raw.사례.filter(유효한가);

  console.log(`전체 ${raw.사례.length}건 중 ${후보.length}건이 형식 검증을 통과했습니다.`);

  let 추가됨 = 0;
  let 건너뜀 = 0;
  let 실패 = 0;

  for (const c of 후보) {
    const { error } = await supabase.from("cases").insert({
      문구: c.문구,
      등급: c.등급,
      지적: `${c.지적} (${c.출처})`,
      수정안: c.수정안,
    });

    if (error) {
      if (error.code === "23505") {
        건너뜀++;
      } else {
        console.error(`실패: "${c.문구}" - ${error.message}`);
        실패++;
      }
      continue;
    }
    추가됨++;
  }

  console.log(`\n완료: 추가 ${추가됨}건 / 중복 건너뜀 ${건너뜀}건 / 실패 ${실패}건`);

  // 변경 이력에도 남긴다(case-store.ts의 audit 기록과 별개로, 대량 삽입은 요약 한 줄만 남긴다).
  const { error: logError } = await supabase.from("case_audit_log").insert({
    action: "insert",
    actor_email: ACTOR_EMAIL,
    이전값: null,
    이후값: { 문구: `[일괄 삽입] 식약처 공공데이터 기반 사례 ${추가됨}건`, 등급: "HIGH RISK", 지적: "-", 수정안: "-" },
  });
  if (logError) console.error("이력 기록 실패:", logError.message);
}

main();
