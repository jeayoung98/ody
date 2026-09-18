import AuthCard from "@/components/auth/auth-card";
import AuthGuard from "@/components/auth/auth-guard";
import ProfileEditForm from "@/components/auth/profile-edit-form";

/** 프로필 수정 (USER-02, S15P21A405-470). 로그인한 사람만 들어온다 */
export default function ProfilePage() {
  return (
    <AuthGuard>
      <AuthCard title="프로필 수정" sub="지도와 프로필에 보이는 모습이에요.">
        <ProfileEditForm />
      </AuthCard>
    </AuthGuard>
  );
}
