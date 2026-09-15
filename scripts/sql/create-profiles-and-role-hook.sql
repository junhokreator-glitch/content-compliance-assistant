-- 사용자 역할(role) 관리
-- 1. profiles 테이블: 가입한 사용자마다 role('user' 기본값)을 저장한다.
-- 2. 가입 시 자동으로 profiles 행을 만드는 트리거.
-- 3. 로그인 시 발급되는 JWT에 role을 심어주는 Custom Access Token Hook.
--
-- 적용 후 Supabase 대시보드 Authentication > Hooks > "Custom Access Token"에
-- custom_access_token_hook 함수를 연결해야 실제로 동작한다(대시보드에서 수동 연결 필요).

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 본인 프로필만 조회 가능. update/insert 정책은 만들지 않는다 —
-- role은 서비스 롤(서버)에서만 바꿀 수 있어야 하고, 사용자가 스스로 관리자로 바꾸는 것을 막기 위함이다.
drop policy if exists "본인 프로필 조회" on public.profiles;
create policy "본인 프로필 조회" on public.profiles
  for select using (auth.uid() = user_id);

-- 신규 가입 시 profiles 행을 기본 role='user'로 자동 생성한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, role)
  values (new.id, new.email, 'user');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 로그인 시 발급되는 JWT의 app_metadata.role에 profiles.role 값을 심는다.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  claims jsonb;
  user_role text;
begin
  select role into user_role from public.profiles
  where user_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  if user_role is not null then
    claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(user_role));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute
  on function public.custom_access_token_hook
  to supabase_auth_admin;

revoke execute
  on function public.custom_access_token_hook
  from authenticated, anon, public;

grant select on public.profiles to supabase_auth_admin;
