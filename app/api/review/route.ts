// 콘텐츠 검수 API
// 입력된 마케팅 문구에서 법무·컴플라이언스 리스크 표현을 찾아 사유와 대체 표현을 돌려준다.

import lawsData from "@/data/laws.json";
import guidelinesData from "@/data/guidelines.json";
import approvedIndications from "@/data/approved-indications.json";
import { getAuthedUser } from "@/app/lib/supabase/server";
import { 사례목록읽기 } from "@/app/lib/case-store";

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";

// 법제처 API로 수집한 규정 원문 (갱신: npm run fetch-laws)
const 규정_원문 = lawsData.규정
  .map((규정) => `[출처: ${규정.출처} / 시행일 ${규정.시행일자}]\n${규정.내용}`)
  .join("\n\n────────\n\n");

// 사내 법무 검토 기준 (갱신: npm run build-guidelines)
const 사내기준 = guidelinesData.지침.map((지침) => 지침.내용).join("\n\n────────\n\n");

// 자사 제품별 허가받은 사용목적 (출처: 각 제품 의료기기 허가·인증증)
const 허가사항 = approvedIndications.제품
  .map((p) => `- ${p.제품명} (${p.허가번호}, ${p.품목})\n  사용목적: ${p.사용목적}\n  참고: ${p.비고}`)
  .join("\n\n");

// 식약처 자율심의기구 실제 심의사례(공공데이터, npm run parse-ad-review-cases 원본)에서
// 반복적으로 요구된 법정 필수 표기 3가지로 정리했다. 원본 23건(표현만 다르고 내용은 중복)은
// data/mfds-ad-review-labeling-requirements.json 참고.
const 법정표기요구사항 = `1. 허가(인증)받은 품목명 및 사용목적을 광고에 기재해야 한다.
2. "이 제품은 '의료기기'이며, '사용상의 주의사항'과 '사용방법'을 잘 읽고 사용하십시오"라는 주의문구를 기재해야 한다.
3. 심의결과(심의필 마크 또는 심의번호)를 광고에 표시해야 한다.`;

// 입력 길이 상한 (PoC 기준)
const MAX_CONTENT_LENGTH = 5000;

// 이 두 영역만 "문구 대체"이고, 나머지(콘텐츠 권리·동의, 환자 정보)는 원문을 고치지 않고 조치만 안내한다.
// app/page.tsx의 같은 이름 상수와 정의가 일치해야 한다.
const 텍스트치환영역 = new Set(["마케팅 표현", "의료기기 광고"]);

// AI가 지킬 규칙 (PRD 5번 기준)
// 사례는 앱에서 추가·삭제할 수 있으므로 요청마다 최신 목록을 읽어 프롬프트를 만든다.
const 시스템프롬프트만들기 = (지적사례: string, 수정본언어: string) =>
  `당신은 의료기기 기업의 마케팅 콘텐츠를 검수하는 법무·컴플라이언스 검수 어시스턴트입니다.

[판단 근거 규정 — 현행 법령 원문]
아래는 법제처 국가법령정보에서 수집한 현행 규정 원문입니다. 판단은 반드시 이 원문에 근거해야 합니다.

${규정_원문}

[판단 근거 2 — 사내 법무·컴플라이언스 검토 기준]
아래는 사내 법무팀의 검토 관점과 원칙입니다. 위 법령과 함께 판단 기준으로 사용합니다.

${사내기준}

[판단 근거 3 — 사내 법무가 실제로 지적했던 사례]
아래는 사내 법무·컴플라이언스가 과거에 지적한 표현과 그때 매긴 등급입니다.
등급을 정할 때는 이 사례들의 기준을 우선 따릅니다. 입력 문구가 아래 사례와 유사한 유형이면 같은 등급으로 판단합니다.

${지적사례}

[판단 근거 4 — 자사 제품별 허가받은 사용목적]
아래는 자사 제품이 실제로 허가(인증)받은 사용목적 원문입니다. 콘텐츠에 아래 제품명(또는 명백히 같은 제품을 가리키는 표현)이 언급되면, 콘텐츠에서 주장하는 효능이 해당 제품의 사용목적 범위 안에 있는지 반드시 대조합니다.

${허가사항}

이 목록에 없는 제품이거나 콘텐츠에 특정 제품명이 언급되지 않은 경우에는 이 판단 근거를 적용하지 않고 기존 기준대로만 판단합니다.

[판단 근거 5 — 광고에 반드시 들어가야 하는 법정 표기]
아래는 식약처 자율심의기구의 실제 심의사례(공공데이터)에서 반복적으로 요구된, 의료기기 광고에 빠지면 안 되는 필수 표기입니다.

${법정표기요구사항}

콘텐츠가 완성된 광고물(제품 소개·판매 목적의 게시물 등)로 보이는데 이 표기들이 안 보이면 "법정 표기 사항" 카테고리로 지적합니다. 행사 안내, 채용 공고처럼 제품 광고가 아닌 콘텐츠에는 적용하지 않습니다.
이 카테고리는 표현 자체가 아니라 표기 누락이 문제이고, 문구를 추가하면 해결되므로 verdict는 항상 "CONDITIONAL"입니다("HIGH RISK"로 판단하지 않습니다).

[검토 범위]
이 도구는 다음 다섯 가지 영역만 검토합니다.
- 마케팅 표현: 과장·오인, 우월성 주장, 비교 광고, 소비자 유인
- 의료기기 광고: 효능·효과 단정, 법령상 금지 광고 유형
- 콘텐츠 권리·동의: 연자(Speaker) 발표자료·영상·음성·초상 사용 범위, 재사용·번역·글로벌 사용 권리, 제3자 제공
- 환자 정보: 환자 동의 여부, 식별 가능한 정보 노출
- 법정 표기 사항: 허가품목명·사용목적·주의문구·심의필 표시 누락

계약서 검토, 벤더·대행사 관리, 내부 프로세스는 이 도구의 범위가 아니므로 지적하지 않습니다.
문체, 맞춤법, 마케팅 효과에 대해서도 지적하지 않습니다.

이 도구는 오직 한국 법령(의료기기법 등) 기준으로만 판단합니다. 입력 콘텐츠가 영어라도 미국 FDA, 유럽 MDR 등 해외 규정은 판단 기준에 포함되지 않으며, 해외 규정 위반 여부는 언급하거나 추측하지 않습니다.

[입력 언어와 수정본 언어]
입력 콘텐츠는 한국어 또는 영어일 수 있습니다. 언어와 무관하게 위와 동일한 기준으로 판단합니다.
담당자가 원하는 수정본 언어를 별도로 지정했습니다: **${수정본언어}**. 입력 콘텐츠의 언어와 다를 수 있습니다.
- excerpt: 지정된 수정본 언어와 무관하게, 항상 입력 원문에 실제 존재하는 문구를 원문 언어 그대로 인용합니다(어떤 리스크 표현을 가리키는지 원문에서 찾을 수 있어야 하므로).
- suggestions: 입력 원문의 언어가 아니라 **${수정본언어}**로 작성하고, 콘텐츠에 바로 대체해 넣을 수 있는 완성된 문구만 담습니다. 여러 안을 제시할 때도 각 배열 항목은 하나의 완성된 문구여야 하며, "또는", "등", 안내 문구, 괄호 설명 등을 덧붙이지 않습니다. 안이 여러 개면 배열 항목을 늘립니다.
- revisedContent: 전체를 **${수정본언어}**로 작성합니다. 입력 원문이 다른 언어라면 리스크가 없는 부분도 자연스럽게 ${수정본언어}로 옮겨서, 처음부터 ${수정본언어}로 작성된 것처럼 하나의 완성된 글이 되게 합니다.
- reason, basis: 검수 담당자가 한국어로 읽으므로 수정본 언어와 무관하게 항상 한국어로 작성합니다.

[리스크 등급]
등급을 가르는 기준은 "객관적 근거를 붙이거나 표현을 보완하면 그 표현을 쓸 수 있는가"입니다.

- HIGH RISK: 어떤 근거 자료를 붙여도 그대로 쓸 수 없어 표현 자체를 바꿔야 하는 경우.
  예) 부작용·통증의 부존재, 효과나 유지기간의 보장·단정(완벽·평생·영구·전혀·반드시), 적응증을 과도하게 확대하는 표현, 전문가의 추천·권위 이용, 타사와의 직접 비교, 필수 동의·권리 미확보, **자사 제품이 허가받은 사용목적 범위를 벗어난 효능 주장**(판단 근거 4 대조 결과)

- CONDITIONAL: 객관적 근거(조사 기관·표본 수·조사 방법·임상 결과 등)를 함께 제시하거나 보조 문구를 덧붙이면 그대로 쓸 수 있는 경우.
  예) 수치·비율 주장, 순위·점유율·선택률 주장, 검증·입증 주장, 시술 결과 예시 제시, **법정 표기 사항 누락**(항상 CONDITIONAL — 판단 근거 5 참고)

수치나 순위 주장은 근거만 붙이면 사용할 수 있으므로 HIGH RISK가 아니라 CONDITIONAL입니다.
다만 한 문구에 두 성격이 섞여 있으면 더 높은 등급을 따릅니다. 예를 들어 "임상적으로 완벽하게 입증"은 입증 주장(CONDITIONAL)과 완벽 표현(HIGH RISK)이 섞여 있으므로 HIGH RISK입니다.

[반드시 지킬 규칙]
1. basis에는 위 법령 원문에 실제로 존재하는 내용만 인용하고, 출처(법령명·조문번호·별표 호수)를 정확히 밝힙니다. 위 원문에 없는 조문 번호나 규정 이름을 지어내지 않습니다.
2. 법령에 명확히 해당하면 verdict를 "HIGH RISK"로 하고 해당 조문을 basis에 인용합니다.
3. 법령에 명시적으로 해당하지는 않지만 사내 기준상 과장·오인 소지가 있거나 동의·권리 확인이 필요하면 verdict를 "CONDITIONAL"로 하고, basis에 "명시적 근거 조문 없음 — 사내 기준상 확인 필요"임을 밝힙니다. 근거 없이 HIGH RISK로 단정하지 않습니다.
   판단 근거 4의 제품이 언급되어 사용목적과 대조가 가능한 경우는 예외입니다: 주장하는 효능이 그 제품의 사용목적 범위를 명백히 벗어나면 "허가받지 않은 효능·효과 광고"(의료기기법 시행규칙 별표7 제2호)를 basis에 인용해 HIGH RISK로 판단하고, 범위 안에 있으면 그 자체로는 리스크가 아니므로 findings에 넣지 않습니다(다른 사유로 리스크가 있으면 그 사유로만 판단).
   이때 **기술적 작동 방식 설명**과 **임상적 효능 주장**을 구분합니다. "더 깊이/넓게/균일하게 에너지(열, 초음파 등)를 전달한다"처럼 기기가 물리적으로 어떻게 작동하는지에 대한 설명은, 그 자체로 "그래서 치료 효과가 더 좋다/개선된다/우수하다"는 결과·효능을 단정하지 않는 한 사용목적 범위를 벗어난 것으로 보지 않습니다(HIGH RISK로 판단하지 않음). "~효과가 개선됩니다", "~더 나은 결과를 제공합니다"처럼 결과·효능까지 단정하는 문구가 실제로 있을 때만 이 규칙을 적용합니다.
4. 판단이 불확실하면 더 낮은 리스크로 단정하지 말고, 보수적으로 CONDITIONAL로 분류합니다.
   단, 위 지적 사례와 유사한 유형이면 법령 해석보다 사례의 등급을 우선합니다.
5. 대체 표현(suggestions)은 원문의 마케팅 의도와 핵심 의미를 유지하는 범위에서만 제안하며, 원문에 없는 사실이나 효능을 새로 추가하지 않습니다. 동의·권리 문제, 법정 표기 누락인 경우에는 표현 대신 필요한 조치(무엇을 어떤 문구로 추가해야 하는지)를 제시합니다.
   suggestions는 그 문구만 다시 검수해도 SAFE로 판정될 수 있도록 작성하는 것을 우선합니다. 이를 위해 "완화"가 아니라 "제거"를 기본 전략으로 삼습니다: 순위·점유율·선택률·신뢰도·인기(예: 1위, 최고, 많은 고객이 신뢰, 널리 사용 등 어떤 형태로든 우월성·인기·신뢰를 암시하는 표현)를 다른 표현으로 순화하지 말고 문장에서 통째로 빼고, 남은 부분(제품명·객관적 기능 설명 등)만으로 문장을 구성합니다. 예: "국내 1위 리프팅 장비입니다" → (X) "많은 고객이 신뢰하는 리프팅 장비입니다" (여전히 근거 필요한 인기 주장) → (O) "리프팅 장비입니다".
   효능·효과 표현의 대체안을 만들 때: 언급된 제품이 판단 근거 4에 있으면 그 사용목적 범위 안의 효능으로 표현해 SAFE를 노립니다(예: 리니어지는 "눈썹 리프팅"을 그대로 써도 됨). 제품이 언급되지 않았거나 목록에 없는 제품이면 허가 범위를 확인할 수 없으므로, 효능을 구체적으로 표현하지 않고 "제품/시술 안내" 수준으로만 표현해 SAFE를 우선합니다.
   다만 이렇게 만들면 suggestions[0]은 SAFE 우선 버전으로, suggestions[1]이 있다면 원문의 마케팅 의도를 더 살린 CONDITIONAL 버전(근거를 붙이면 쓸 수 있음을 basis나 reason에서 이미 설명)으로 두어, 사용자가 상황에 맞게 고르게 합니다.
6. suggestions는 항상 최소 1개 이상 제시합니다.
7. excerpt에는 입력된 원문에 실제로 존재하는 문구를 그대로 인용합니다. 원문에 없는 문장을 만들어내지 않습니다.
   법정 표기 사항처럼 "빠진 것"이 문제인 경우는 예외입니다: 인용할 문구가 없으므로 excerpt에는 원문의 첫 문장(또는 제목)을 넣어 어떤 콘텐츠를 가리키는지 표시하고, reason에 무엇이 빠졌는지 명확히 적습니다.
8. 리스크가 없으면 findings를 빈 배열로 하고 overallRisk를 "SAFE"로 반환합니다.
9. overallRisk는 findings 중 가장 높은 등급을 따릅니다. HIGH RISK가 하나라도 있으면 "HIGH RISK"입니다.
10. revisedContent는 findings의 suggestions를 개별적으로 이어 붙인 것이 아니라, 원문 전체를 놓고 ${수정본언어}로 다시 자연스럽게 작성한 하나의 완성된 글입니다. 문장 연결(조사, 어미)이 어색해지지 않도록 필요하면 문장 구조 자체를 바꿉니다. 리스크가 없던 부분은 내용과 어조를 그대로 유지하되, 수정본 언어가 원문과 다르면 그 부분도 ${수정본언어}로 옮깁니다. findings가 비어 있어도, 입력 원문의 언어가 ${수정본언어}와 다르면 원문을 그대로 반환하지 말고 ${수정본언어}로 옮겨서 반환합니다(언어가 같다면 원문과 동일하게 반환).
   category가 "콘텐츠 권리·동의", "환자 정보", "법정 표기 사항"인 finding은 문구 자체가 문제가 아니라 별도 절차나 추가 표기가 빠진 것이므로, 해당 부분의 원문 문장은 고치지 않고 그대로 둡니다. 그 finding의 suggestions(필요한 조치)를 revisedContent 본문 안에 지시문·안내문 형태로 써 넣지 않습니다. 이런 finding만 있고 "마케팅 표현"·"의료기기 광고" finding이 없다면 revisedContent는 원문과 동일합니다.`;

// 구조화된 응답 형식
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    overallRisk: {
      type: "string",
      enum: ["SAFE", "CONDITIONAL", "HIGH RISK"],
      description: "콘텐츠 전체의 리스크 등급",
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          excerpt: { type: "string", description: "원문에서 리스크가 있는 문구를 그대로 인용" },
          category: {
            type: "string",
            enum: ["마케팅 표현", "의료기기 광고", "콘텐츠 권리·동의", "환자 정보", "법정 표기 사항"],
          },
          verdict: { type: "string", enum: ["HIGH RISK", "CONDITIONAL"] },
          reason: { type: "string", description: "리스크로 판단한 사유" },
          basis: { type: "string", description: "인용한 규정의 출처(법령명·조문번호·별표 호수)와 내용" },
          suggestions: {
            type: "array",
            items: { type: "string" },
            description: "대체 표현 또는 필요한 조치 (최소 1개)",
          },
        },
        required: ["excerpt", "category", "verdict", "reason", "basis", "suggestions"],
        additionalProperties: false,
      },
    },
    revisedContent: {
      type: "string",
      description:
        "마케팅 표현·의료기기 광고 리스크를 반영해 다시 쓴, 원문 전체 분량의 완성된 수정본. 콘텐츠 권리·동의/환자 정보/법정 표기 사항 findings는 문구 수정 대상이 아니므로 반영하지 않는다.",
    },
  },
  required: ["overallRisk", "findings", "revisedContent"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  if (!(await getAuthedUser())) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const content = body?.content;
  const 수정본언어 = body?.language === "en" ? "영어" : "한국어";

  if (typeof content !== "string" || content.trim().length === 0) {
    return Response.json({ error: "검수할 콘텐츠를 입력해 주세요." }, { status: 400 });
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return Response.json(
      { error: `콘텐츠가 너무 깁니다. ${MAX_CONTENT_LENGTH}자 이내로 입력해 주세요.` },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY가 설정되어 있지 않습니다. .env 파일을 확인해 주세요." },
      { status: 500 },
    );
  }

  const 사례목록 = await 사례목록읽기();
  const 시스템프롬프트 = 시스템프롬프트만들기(
    사례목록.map((사례) => `- "${사례.문구}" → ${사례.등급} (${사례.지적})`).join("\n"),
    수정본언어,
  );

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: 시스템프롬프트 },
        { role: "user", content: `다음 마케팅 콘텐츠를 검수해 주세요.\n\n---\n${content}\n---` },
      ],
      max_tokens: 4000,
      // 같은 콘텐츠를 다시 검수했을 때 판정이 오락가락하지 않도록 무작위성을 최소화한다.
      // (기본값 1.0으로 두면 같은 입력에도 SAFE/HIGH RISK가 번갈아 나올 수 있었다.)
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: { name: "review_result", strict: true, schema: RESPONSE_SCHEMA },
      },
    }),
    signal: AbortSignal.timeout(60000),
  }).catch(() => null);

  if (!response?.ok) {
    // 키 값이 로그에 남지 않도록 상태 코드만 기록한다.
    console.error("AI 검수 요청 실패:", response?.status ?? "네트워크 오류");

    if (response?.status === 429) {
      return Response.json(
        { error: "요청이 몰려 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 },
      );
    }
    return Response.json(
      { error: "AI 검수 요청에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }

  const data = await response.json();
  const rawResult = data?.choices?.[0]?.message?.content;

  // 응답 길이 한도에 걸려 JSON이 잘린 경우를 구분한다.
  if (data?.choices?.[0]?.finish_reason === "length") {
    console.error("AI 응답이 길이 제한으로 잘림");
    return Response.json(
      { error: "검수 결과가 너무 길어 처리하지 못했습니다. 콘텐츠를 나눠서 검수해 주세요." },
      { status: 502 },
    );
  }

  try {
    const 결과 = JSON.parse(rawResult);

    // AI가 만든 revisedContent가 "콘텐츠 권리·동의"/"환자 정보" 관련 원문 문장을 삭제하지 않았는지 검증한다.
    // 이 카테고리는 문구 대체 대상이 아니라 원문이 그대로 남아 있어야 하는데, 검증 없이 그대로 내려주면
    // AI가 문장을 조치 안내문으로 바꿔치기하거나 통째로 지워도 사용자가 눈치채기 어렵다.
    // 단, 수정본을 원문과 다른 언어로 요청한 경우 revisedContent 전체가 번역되므로 원문 그대로의
    // 문자열 매칭 자체가 성립하지 않는다 — 이 경우 검증을 건너뛰고 AI의 번역을 신뢰한다.
    const 조치대상_findings = (결과.findings ?? []).filter(
      (f: { category: string }) => !텍스트치환영역.has(f.category),
    );
    const 원문보존확인 =
      수정본언어 !== "한국어" ||
      조치대상_findings.every((f: { excerpt: string }) => 결과.revisedContent?.includes(f.excerpt));

    if (!원문보존확인) {
      console.error("revisedContent가 콘텐츠 권리·동의/환자 정보 관련 원문을 훼손함 — 안전한 방식으로 대체");
      // 신뢰할 수 없으므로, 텍스트 대체 대상 findings만 원문에서 단순 치환해 안전하게 재구성한다.
      let 안전한수정본 = content;
      for (const f of 결과.findings ?? []) {
        if (!텍스트치환영역.has(f.category)) continue;
        const 대체표현 = f.suggestions?.[0];
        if (대체표현 && 안전한수정본.includes(f.excerpt)) {
          안전한수정본 = 안전한수정본.replace(f.excerpt, 대체표현);
        }
      }
      결과.revisedContent = 안전한수정본;
    }

    // 어떤 규정을 기준으로 검수했는지 함께 내려준다.
    const 기준규정 = lawsData.규정.map(({ 출처, 시행일자 }) => ({ 출처, 시행일자 }));
    return Response.json({ ...결과, 기준규정 });
  } catch {
    console.error("AI 응답 형식 오류");
    return Response.json(
      { error: "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
