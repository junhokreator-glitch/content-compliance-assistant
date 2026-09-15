// 사내 법무 지적 사례 저장소
// Supabase(Postgres)의 cases 테이블을 사용한다.
// service role 키로 서버(API 라우트)에서만 접근하며, 클라이언트에는 절대 노출하지 않는다.

import { createClient } from "@supabase/supabase-js";

export type 등급 = "HIGH RISK" | "CONDITIONAL";

export type 사례입력 = {
  문구: string;
  등급: 등급;
  지적: string;
  수정안: string;
};

export type 사례 = 사례입력 & { id: number };

export type 변경이력 = {
  id: number;
  case_id: number | null;
  action: "insert" | "update" | "delete";
  actor_email: string;
  이전값: 사례입력 | null;
  이후값: 사례입력 | null;
  created_at: string;
};

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
  }
  return createClient(url, key);
}

// 이 테이블은 이 서비스의 AI 판단 기준을 바꾸는 민감한 데이터라 누가 언제 무엇을 바꿨는지 남긴다.
// 로그 기록이 실패해도 본작업(추가·수정·삭제) 자체는 막지 않고 콘솔에만 남긴다.
async function 변경이력기록(entry: Omit<변경이력, "id" | "created_at">) {
  const { error } = await supabase().from("case_audit_log").insert(entry);
  if (error) console.error("사례 변경 이력 기록 실패:", error.message);
}

export async function 사례목록읽기(): Promise<사례[]> {
  // 생성된 DB 타입이 없어 select 문자열을 타입 레벨로 파싱하지 못하므로 "*"로 조회 후 캐스팅한다.
  const { data, error } = await supabase()
    .from("cases")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`사례 목록 조회 실패: ${error.message}`);
  return (data ?? []).map(({ id, 문구, 등급, 지적, 수정안 }) => ({ id, 문구, 등급, 지적, 수정안 }));
}

// 문구는 테이블의 unique 제약으로 중복이 막힌다.
export async function 사례추가(
  새사례: 사례입력,
  actorEmail: string,
): Promise<{ 성공: boolean; 사유?: string }> {
  const { data, error } = await supabase().from("cases").insert(새사례).select("id").single();

  if (error) {
    if (error.code === "23505") return { 성공: false, 사유: "같은 문구의 사례가 이미 있습니다." };
    return { 성공: false, 사유: `사례 저장 실패: ${error.message}` };
  }

  await 변경이력기록({
    case_id: data.id,
    action: "insert",
    actor_email: actorEmail,
    이전값: null,
    이후값: 새사례,
  });
  return { 성공: true };
}

export async function 사례수정(
  id: number,
  수정내용: 사례입력,
  actorEmail: string,
): Promise<{ 성공: boolean; 사유?: string }> {
  // 이력에 남길 "이전값"은 덮어쓰기 전에 미리 읽어둬야 한다.
  const { data: 기존행 } = await supabase()
    .from("cases")
    .select("문구, 등급, 지적, 수정안")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase()
    .from("cases")
    .update(수정내용)
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23505") return { 성공: false, 사유: "같은 문구의 사례가 이미 있습니다." };
    return { 성공: false, 사유: `사례 수정 실패: ${error.message}` };
  }
  if (!data || data.length === 0) return { 성공: false, 사유: "해당 사례를 찾지 못했습니다." };

  await 변경이력기록({
    case_id: id,
    action: "update",
    actor_email: actorEmail,
    이전값: (기존행 as 사례입력 | null) ?? null,
    이후값: 수정내용,
  });
  return { 성공: true };
}

export async function 사례삭제(
  id: number,
  actorEmail: string,
): Promise<{ 성공: boolean; 사유?: string }> {
  const { data: 기존행 } = await supabase()
    .from("cases")
    .select("문구, 등급, 지적, 수정안")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase().from("cases").delete().eq("id", id).select("id");

  if (error) return { 성공: false, 사유: `사례 삭제 실패: ${error.message}` };
  if (!data || data.length === 0) return { 성공: false, 사유: "해당 사례를 찾지 못했습니다." };

  await 변경이력기록({
    case_id: id,
    action: "delete",
    actor_email: actorEmail,
    이전값: (기존행 as 사례입력 | null) ?? null,
    이후값: null,
  });
  return { 성공: true };
}

// 관리자 전용 "변경 이력" 화면에서 사용한다.
export async function 변경이력목록읽기(): Promise<변경이력[]> {
  const { data, error } = await supabase()
    .from("case_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(`변경 이력 조회 실패: ${error.message}`);
  return data ?? [];
}
