/**
 * 가입·로그인 입력 규칙. **backend/dev 의 AuthService·NicknamePolicy 와 같은 기준**이다 (S15P21A405-121).
 * 화면 즉시 피드백용이고, 최종 판단은 서버가 한다.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 영문+숫자 포함 8자 이상 (백엔드 PASSWORD_PATTERN 과 동일) */
export const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
/** bcrypt 가 UTF-8 72바이트를 넘기면 초과분을 조용히 버려서 백엔드가 바이트로 자른다 */
export const PASSWORD_MAX_BYTES = 72;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return "이메일을 입력해주세요.";
  return EMAIL_RE.test(v) ? null : "이메일 형식이 아니에요.";
}

/** 로그인은 형식을 따지지 않는다 — 서버가 맞는지만 본다 */
export function loginPasswordError(value: string): string | null {
  return value ? null : "비밀번호를 입력해주세요.";
}

export function passwordError(value: string): string | null {
  if (!value) return "비밀번호를 입력해주세요.";
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) return "비밀번호가 너무 길어요 (72바이트 이하).";
  return PASSWORD_RE.test(value) ? null : "영문과 숫자를 포함해 8자 이상이어야 해요.";
}

/** 닉네임은 2~20자. 중복 여부는 서버만 알 수 있어서 여기서는 보지 않는다 */
export function nicknameError(value: string): string | null {
  const v = value.trim();
  if (!v) return "닉네임을 입력해주세요.";
  if (v.length < NICKNAME_MIN) return `${NICKNAME_MIN}자 이상 입력해주세요.`;
  if (v.length > NICKNAME_MAX) return `${NICKNAME_MAX}자까지 쓸 수 있어요.`;
  return null;
}
