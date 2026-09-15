-- 사례(cases) 변경 이력 테이블
-- 추가·수정·삭제 시 case-store.ts에서 이 테이블에 기록한다(서비스 롤 클라이언트로만 씀).
-- 관리자 전용 화면(/admin/history)에서 이 기록을 조회한다.

create table if not exists public.case_audit_log (
  id bigint generated always as identity primary key,
  case_id bigint,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_email text not null,
  이전값 jsonb,
  이후값 jsonb,
  created_at timestamptz not null default now()
);

-- 이 테이블은 항상 서비스 롤(서버)로만 읽고 쓴다. 클라이언트에는 정책을 주지 않아 기본적으로 전면 차단한다.
alter table public.case_audit_log enable row level security;
