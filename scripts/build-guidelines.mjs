// my-data 폴더의 사내 법무 검토 기준 문서(.md)를 앱이 읽을 수 있는 JSON으로 변환한다.
// my-data의 문서를 수정하거나 추가한 뒤 실행한다.
// 실행: npm run build-guidelines

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";

const 원본폴더 = "my-data";

async function main() {
  const 파일목록 = (await readdir(원본폴더)).filter((이름) => 이름.endsWith(".md")).sort();
  if (파일목록.length === 0) throw new Error(`${원본폴더} 폴더에 .md 문서가 없습니다.`);

  const 지침 = [];
  for (const 파일명 of 파일목록) {
    const 내용 = (await readFile(`${원본폴더}/${파일명}`, "utf-8")).trim();
    지침.push({ 출처: 파일명, 내용 });
  }

  await mkdir("data", { recursive: true });
  await writeFile(
    "data/guidelines.json",
    JSON.stringify({ 수집일시: new Date().toISOString(), 지침 }, null, 2),
    "utf-8",
  );

  console.log(`변환 완료: ${지침.length}건`);
  for (const g of 지침) console.log(` - ${g.출처} (${g.내용.length}자)`);
}

main();
