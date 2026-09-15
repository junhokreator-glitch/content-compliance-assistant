-- 공개 회원가입을 @jeisys.com 도메인 이메일만 허용한다.
-- 적용 후 Supabase 대시보드 Authentication > Hooks > "Before User Created"에
-- 아래 함수를 연결해야 실제로 동작한다(대시보드에서 수동 연결 필요).

create or replace function public.hook_restrict_signup_by_email_domain(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  email text;
  domain text;
begin
  email := event->'user'->>'email';
  domain := split_part(email, '@', 2);

  if lower(domain) <> 'jeisys.com' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', '회사 이메일(@jeisys.com)로만 가입할 수 있습니다.',
        'http_code', 403
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant execute
  on function public.hook_restrict_signup_by_email_domain
  to supabase_auth_admin;

revoke execute
  on function public.hook_restrict_signup_by_email_domain
  from authenticated, anon, public;
