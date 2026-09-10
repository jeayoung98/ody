/**
 * 가입·로그인 입력 규칙 (AUTH-01). 화면과 목 API 라우트가 **같은 규칙·같은 문구**를 쓴다.
 * 실제 백엔드가 붙으면 서버 검증이 기준이 되고 여기는 화면 즉시 피드백용으로 남는다.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 8;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return "이메일을 입력해주세요.";
  return EMAIL_RE.test(v) ? null : "이메일 형식이 아니에요.";
}

export function passwordError(value: string): string | null {
  if (!value) return "비밀번호를 입력해주세요.";
  return value.length >= PASSWORD_MIN ? null : `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`;
}

/** 닉네임은 2~20자. 중복 여부는 서버만 알 수 있어서 여기서는 보지 않는다 */
export function nicknameError(value: string): string | null {
  const v = value.trim();
  if (!v) return "닉네임을 입력해주세요.";
  if (v.length < NICKNAME_MIN) return `${NICKNAME_MIN}자 이상 입력해주세요.`;
  if (v.length > NICKNAME_MAX) return `${NICKNAME_MAX}자까지 쓸 수 있어요.`;
  return null;
}
