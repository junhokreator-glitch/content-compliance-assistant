// 사례 관리 API
// 사내 법무 지적 사례를 조회·추가·수정·삭제한다. 검수 API가 이 사례들을 등급 판단 기준으로 사용한다.
// 로그인한 사용자는 누구나 추가·수정·삭제할 수 있고, 그 행위자 이메일이 변경 이력에 기록된다.

import { getAuthedUser } from "@/app/lib/supabase/server";
import { 사례목록읽기, 사례추가, 사례수정, 사례삭제, type 등급 } from "@/app/lib/case-store";

const 허용등급: 등급[] = ["HIGH RISK", "CONDITIONAL"];

function 입력값검증(body: unknown) {
  const 문구 = String((body as { 문구?: unknown })?.문구 ?? "").trim();
  const 지적 = String((body as { 지적?: unknown })?.지적 ?? "").trim();
  const 수정안 = String((body as { 수정안?: unknown })?.수정안 ?? "").trim();
  const 등급 = (body as { 등급?: unknown })?.등급;

  if (!문구 || !지적 || !수정안) {
    return { error: "문구, 지적 사유, 수정안을 모두 입력해 주세요." } as const;
  }
  if (!허용등급.includes(등급 as 등급)) {
    return { error: "등급은 HIGH RISK 또는 CONDITIONAL이어야 합니다." } as const;
  }
  return { value: { 문구, 등급: 등급 as 등급, 지적, 수정안 } } as const;
}

export async function GET() {
  if (!(await getAuthedUser())) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return Response.json({ 사례: await 사례목록읽기() });
}

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const 검증결과 = 입력값검증(body);
  if ("error" in 검증결과) return Response.json({ error: 검증결과.error }, { status: 400 });

  const 결과 = await 사례추가(검증결과.value, user.email);
  if (!결과.성공) return Response.json({ error: 결과.사유 }, { status: 409 });

  return Response.json({ 사례: await 사례목록읽기() });
}

export async function PATCH(request: Request) {
  const user = await getAuthedUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = Number((body as { id?: unknown })?.id);

  if (!Number.isInteger(id)) {
    return Response.json({ error: "수정할 사례의 id가 필요합니다." }, { status: 400 });
  }

  const 검증결과 = 입력값검증(body);
  if ("error" in 검증결과) return Response.json({ error: 검증결과.error }, { status: 400 });

  const 결과 = await 사례수정(id, 검증결과.value, user.email);
  if (!결과.성공) {
    const status = 결과.사유?.includes("찾지 못했습니다") ? 404 : 409;
    return Response.json({ error: 결과.사유 }, { status });
  }

  return Response.json({ 사례: await 사례목록읽기() });
}

export async function DELETE(request: Request) {
  const user = await getAuthedUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = Number((body as { id?: unknown })?.id);

  if (!Number.isInteger(id)) {
    return Response.json({ error: "삭제할 사례의 id가 필요합니다." }, { status: 400 });
  }

  const 결과 = await 사례삭제(id, user.email);
  if (!결과.성공) return Response.json({ error: 결과.사유 }, { status: 404 });

  return Response.json({ 사례: await 사례목록읽기() });
}
