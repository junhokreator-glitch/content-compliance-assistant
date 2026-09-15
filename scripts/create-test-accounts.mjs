// 로그인 테스트용 관리자/일반 계정을 Admin API로 직접 생성한다 (이메일 확인 절차 생략).
// 실행: npm run create-test-accounts

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 없습니다.");

const supabase = createClient(url, serviceKey);

const 비밀번호생성 = () =>
  Array.from({ length: 16 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%".charAt(
      Math.floor(Math.random() * 62),
    ),
  ).join("");

const 계정목록 = [
  { email: "admin@jeisys.com", role: "admin" },
  { email: "user@jeisys.com", role: "user" },
];

async function main() {
  for (const 계정 of 계정목록) {
    const password = 비밀번호생성();

    const { data, error } = await supabase.auth.admin.createUser({
      email: 계정.email,
      password,
      email_confirm: true,
    });

    if (error) {
      console.error(`✗ ${계정.email} 생성 실패: ${error.message}`);
      continue;
    }

    // 가입 트리거가 profiles 행을 'user'로 만들어두므로, admin 계정만 역할을 올려준다.
    if (계정.role === "admin") {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role: "admin" })
        .eq("user_id", data.user.id);
      if (updateError) console.error(`  role 갱신 실패: ${updateError.message}`);
    }

    console.log(`✓ ${계정.email} (${계정.role}) 생성 완료`);
    console.log(`  비밀번호: ${password}`);
  }

  console.log("\n로그인 후 반드시 비밀번호를 변경하는 것을 권장합니다.");
}

main();
