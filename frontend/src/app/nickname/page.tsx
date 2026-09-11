import AuthCard from "@/components/auth/auth-card";
import AuthGuard from "@/components/auth/auth-guard";
import NicknameForm from "@/components/auth/nickname-form";

/**
 * 가입 직후 닉네임 설정 (AUTH-01). 이메일·구글 어느 쪽으로 가입해도 여기를 거친다.
 * 닉네임이 없는 상태이므로 requireNickname 은 끈다 (여기서 되돌려 보내면 무한 이동).
 */
export default function NicknamePage() {
  return (
    <AuthGuard requireNickname={false}>
      <AuthCard title="어떻게 부를까요?" sub="지도와 프로필에 이 이름으로 보입니다. 나중에 마이페이지에서 바꿀 수 있어요.">
        <NicknameForm />
      </AuthCard>
    </AuthGuard>
  );
}
