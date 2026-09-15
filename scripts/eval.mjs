// 검수 성능 측정 스크립트
// 테스트셋을 검수 API에 넣어 탐지율, 오탐율, 등급 일치율을 계산한다.
// 실행: npm run eval -- http://localhost:3000 [테스트셋 경로]

import { readFile } from "node:fs/promises";

const BASE_URL = process.argv[2] ?? "http://localhost:3000";
const 테스트셋 = process.argv[3] ?? "data/testcases.json";

const 대기 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// API 호출 한도(429)에 걸리면 간격을 늘려가며 재시도한다.
async function 검수(문구, 남은재시도 = 4) {
  const response = await fetch(`${BASE_URL}/api/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: 문구 }),
  });

  if (response.status === 429 && 남은재시도 > 0) {
    const 대기시간 = (5 - 남은재시도) * 5000;
    console.log(`     (요청 한도 초과, ${대기시간 / 1000}초 대기 후 재시도)`);
    await 대기(대기시간);
    return 검수(문구, 남은재시도 - 1);
  }

  if (!response.ok) throw new Error(`검수 실패 (${response.status})`);
  return response.json();
}

async function main() {
  console.log(`테스트셋: ${테스트셋}\n`);
  const { 케이스 } = JSON.parse(await readFile(테스트셋, "utf-8"));
  const 결과 = [];

  for (const 케이스하나 of 케이스) {
    const { findings, overallRisk } = await 검수(케이스하나.문구);
    const 탐지됨 = findings.length > 0;
    const 성공 = 케이스하나.기대 === "탐지" ? 탐지됨 : !탐지됨;

    // 기대한 조문을 근거로 인용했는지 확인한다.
    const 근거전체 = findings.map((f) => f.basis).join(" ");
    const 근거일치 =
      케이스하나.근거키워드?.some((키워드) => 근거전체.includes(키워드)) ?? null;

    // 법무가 매긴 등급과 앱의 판정이 일치하는지 확인한다.
    const 등급일치 = 케이스하나.기대등급 ? overallRisk === 케이스하나.기대등급 : null;

    결과.push({ ...케이스하나, 탐지됨, 성공, 근거일치, 등급일치, overallRisk, findings });

    const 등급표시 = 케이스하나.기대등급
      ? ` [${overallRisk}${등급일치 ? "" : ` ≠ ${케이스하나.기대등급}`}]`
      : "";
    console.log(
      `${성공 ? "O" : "X"} ${케이스하나.id.padEnd(9)} ${케이스하나.유형 ?? 케이스하나.문구}${등급표시}`,
    );
    if (!성공) console.log(`     └ 기대: ${케이스하나.기대} / 실제 탐지 ${findings.length}건`);

    await 대기(3000);
  }

  const 위반케이스 = 결과.filter((r) => r.기대 === "탐지");
  const 정상케이스 = 결과.filter((r) => r.기대 === "정상");
  const 탐지성공 = 위반케이스.filter((r) => r.성공).length;
  const 오탐 = 정상케이스.filter((r) => !r.성공).length;
  const 근거정확 = 위반케이스.filter((r) => r.근거일치).length;
  const 비율 = (분자, 분모) => (분모 === 0 ? "-" : `${Math.round((분자 / 분모) * 100)}%`);

  console.log("\n────────── 측정 결과 ──────────");
  console.log(`탐지율     ${탐지성공}/${위반케이스.length} (${비율(탐지성공, 위반케이스.length)})`);
  if (정상케이스.length > 0) {
    console.log(`오탐       ${오탐}/${정상케이스.length} (${비율(오탐, 정상케이스.length)})`);
  }
  if (근거정확 > 0) {
    console.log(`근거 정확도 ${근거정확}/${위반케이스.length} (${비율(근거정확, 위반케이스.length)})`);
  }

  const 등급대상 = 결과.filter((r) => r.등급일치 !== null);
  if (등급대상.length > 0) {
    const 등급맞음 = 등급대상.filter((r) => r.등급일치).length;
    console.log(`등급 일치율 ${등급맞음}/${등급대상.length} (${비율(등급맞음, 등급대상.length)})`);
  }

  const 실패 = 결과.filter((r) => !r.성공);
  if (실패.length > 0) {
    console.log("\n놓친 케이스:");
    for (const r of 실패) console.log(` - ${r.id}: ${r.문구}`);
  }

  const 등급불일치 = 등급대상.filter((r) => !r.등급일치);
  if (등급불일치.length > 0) {
    console.log("\n등급이 다른 케이스:");
    for (const r of 등급불일치) {
      console.log(` - ${r.id}: "${r.문구}" → 앱 ${r.overallRisk} / 법무 ${r.기대등급}`);
    }
  }
}

main();
