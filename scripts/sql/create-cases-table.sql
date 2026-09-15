-- 사내 법무 지적 사례 테이블
create table if not exists public.cases (
  id bigint generated always as identity primary key,
  문구 text not null unique,
  등급 text not null check (등급 in ('HIGH RISK', 'CONDITIONAL')),
  지적 text not null,
  수정안 text not null,
  created_at timestamptz not null default now()
);

-- 서버(service_role)에서만 접근한다. 클라이언트 직접 접근은 차단한다.
alter table public.cases enable row level security;
