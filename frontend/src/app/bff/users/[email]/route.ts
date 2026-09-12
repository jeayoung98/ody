import { ok } from "@/lib/api-response";
import { findAccount } from "@/mocks/auth";
import { mockProfile } from "@/mocks/user";

export async function GET(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  const decoded = decodeURIComponent(email);
  const profile = mockProfile(decoded);
  // 목으로 가입한 계정이면 그 계정의 닉네임을 보여준다 (기본 목 사용자 닉네임이 뜨지 않게)
  const acc = findAccount(decoded);
  return ok(acc ? { ...profile, email: acc.email, name: null, nickname: acc.nickname } : profile);
}
