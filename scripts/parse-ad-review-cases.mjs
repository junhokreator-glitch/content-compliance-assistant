// 식약처 "의료기기 광고제작사별 심의내역" 공공데이터(자사 66건)를 AI로 구조화한다.
// 각 레코드의 시정사항(여러 지적이 번호로 뭉쳐진 긴 텍스트)을 두 종류로 분리한다.
// 1) 표현 관련 지적 -> 사례 라이브러리에 넣을 형태(문구/등급/지적/수정안)
// 2) 법정 필수 표기 요구사항(주의문구, 품목명 기재, 심의필 표시 등) -> 검수 규정에 반영할 목록
//
// 실행: npm run parse-ad-review-cases
// 결과: data/mfds-ad-review-cases.json, data/mfds-ad-review-labeling-requirements.json

import { readFile, writeFile } from "node:fs/promises";

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";
const 대기 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SCHEMA = {
  type: "object",
  properties: {
    cases: {
      type: "array",
      description: "표현(문구) 관련 지적 사항만. 법정 필수 표기 요구는 여기 넣지 않는다.",
      items: {
        type: "object",
        properties: {
          문구: {
            type: "string",
            description:
              "지적받은 실제 표현. 원문에서 인용부호로 표시된 단어/구절만 따로 떼지 말고, 그 단어가 포함된 최소한의 자연스러운 구절로 재구성한다(예: '최소한'만이 아니라 '최소한의 열 손상으로' 처럼).",
          },
          등급: {
            type: "string",
            enum: ["HIGH RISK", "CONDITIONAL"],
            description:
              "근거 없이 '삭제'만 지시된 경우 HIGH RISK. '입증자료 제출, 제출불가시 삭제'처럼 근거를 대면 쓸 수 있는 경우 CONDITIONAL.",
          },
          지적: { type: "string", description: "왜 문제인지 한국어로 간결하게." },
          수정안: { type: "string", description: "원문 시정 지시를 반영한 대체 표현(제안된 대체문구가 있으면 그대로 사용)." },
        },
        required: ["문구", "등급", "지적", "수정안"],
        additionalProperties: false,
      },
    },
    labeling_requirements: {
      type: "array",
      description:
        "특정 표현이 아니라 광고에 반드시 들어가야 하는 법정 표기 요구사항(주의문구 기재, 허가품목명 기재, 심의필 표시 등). 표현 지적과 구분해서 넣는다.",
      items: { type: "string" },
    },
  },
  required: ["cases", "labeling_requirements"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `당신은 식약처 의료기기 광고 자율심의기구의 시정사항 원문을 구조화하는 보조원입니다.
입력된 시정사항 텍스트(번호가 매겨진 여러 지적이 하나로 뭉쳐 있음)를 항목별로 분리해서 정리합니다.

규칙:
- 표현(문구) 관련 지적(과장, 절대적 표현, 전문가 권위, 비교, 입증자료 필요 등)은 cases 배열에 넣습니다.
- "허가받은 품목명 기재", "의료기기 주의문구 기재", "심의필 표시" 같은 정형화된 법정 표기 요구는 표현 지적이 아니므로 cases에 넣지 않고 labeling_requirements에 문장 그대로 넣습니다(같은 문구가 이미 있으면 중복 추가하지 않음).
- 제품 사양(크기, 전압 등 기술 스펙) 수정 지시는 광고 표현 문제가 아니므로 무시합니다.
- 원문에 없는 내용을 지어내지 않습니다.`;

async function 구조화(rawText) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawText },
      ],
      response_format: { type: "json_schema", json_schema: { name: "parsed", strict: true, schema: SCHEMA } },
    }),
  });

  if (response.status === 429) {
    await 대기(6000);
    return 구조화(rawText);
  }
  if (!response.ok) throw new Error(`OpenAI 호출 실패 (${response.status})`);

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function main() {
  const raw = JSON.parse(await readFile("data/raw/mfds-ad-review-jeisys.json", "utf-8"));
  const items = (raw.body?.items ?? []).map((it) => it.item ?? it);

  const 전체사례 = [];
  const 전체요구사항 = new Set();

  for (const [index, item] of items.entries()) {
    const text = (item.RSLT_NTFCTN_DLBR_CRTN_CONT || "").trim();
    if (!text) continue;

    console.log(`[${index + 1}/${items.length}] ${item.RPRS_PRDLST_NM} (${item.RSLT_NTFCTN_DLBR_RSLT_YMD}) 처리 중...`);
    const { cases, labeling_requirements } = await 구조화(text);

    for (const c of cases) {
      전체사례.push({ ...c, 출처: `식약처 자율심의기구 실제 심의사례 (${item.RSLT_NTFCTN_DLBR_NO || "번호 미상"}, ${item.RSLT_NTFCTN_DLBR_RSLT_YMD})` });
    }
    for (const req of labeling_requirements) 전체요구사항.add(req);

    await 대기(1500);
  }

  await writeFile("data/mfds-ad-review-cases.json", JSON.stringify({ 사례: 전체사례 }, null, 2), "utf-8");
  await writeFile(
    "data/mfds-ad-review-labeling-requirements.json",
    JSON.stringify({ 요구사항: [...전체요구사항] }, null, 2),
    "utf-8",
  );

  console.log(`\n완료: 표현 사례 ${전체사례.length}건, 법정 표기 요구사항 ${전체요구사항.size}건`);
}

main();
