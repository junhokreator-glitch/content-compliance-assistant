// 서버 전용 관리자 클라이언트. Auth Admin API(사용자 강제 삭제 등) 같은
// 민감한 작업에만 사용한다. 절대 클라이언트 코드에서 import하지 않는다.

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
  }
  return createClient(url, key);
}
