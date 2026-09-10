/**
 * 목 계정 저장소 (AUTH-01/02). 이메일 가입·로그인·닉네임을 **개발 서버 메모리**에 들고 있는다.
 * 서버를 재시작하면 사라진다 — 실제 백엔드(BACKEND-NOTES A-10~A-14)가 붙으면 이 파일은 사라진다.
 */
import { mockMe, MOCK_ME_EMAIL } from "./user";

export interface MockAccount {
  email: string;
  password: string;
  /** 가입 직후에는 null — 프론트가 닉네임 설정 화면으로 보낸다 */
  nickname: string | null;
  /** 구글로 만든 계정인가 (비밀번호 없음) */
  social: boolean;
}

/**
 * 개발 서버가 파일을 고칠 때마다 모듈을 다시 평가해서, 모듈 지역 변수에 두면 계정이 사라진다.
 * globalThis 에 달아 두면 HMR 을 넘어 살아남는다 (프로세스가 죽으면 사라지는 건 그대로).
 */
const store = globalThis as typeof globalThis & { __odyMockAccounts?: Map<string, MockAccount> };
const accounts = (store.__odyMockAccounts ??= new Map<string, MockAccount>());

/** 이미 다른 사람이 쓰고 있는 닉네임 (중복 확인을 눈으로 보려면 하나는 막혀 있어야 한다) */
const RESERVED = [mockMe().nickname, "오디", "우주", "admin"].filter(Boolean) as string[];

const TOKEN_PREFIX = "mock-token-";
const norm = (email: string) => email.trim().toLowerCase();

export const tokenFor = (email: string) => `${TOKEN_PREFIX}${encodeURIComponent(norm(email))}`;

/** `Authorization: Bearer mock-token-<email>` 에서 이메일을 꺼낸다. 목 토큰이 아니면 null */
export function emailFromAuth(header: string | null): string | null {
  const raw = (header ?? "").replace(/^Bearer\s+/i, "");
  if (!raw.startsWith(TOKEN_PREFIX)) return null;
  const email = decodeURIComponent(raw.slice(TOKEN_PREFIX.length));
  return EMAIL_RE_LOOSE.test(email) ? norm(email) : null;
}
const EMAIL_RE_LOOSE = /^[^\s@]+@[^\s@]+$/;

export const findAccount = (email: string): MockAccount | null => accounts.get(norm(email)) ?? null;

export function createAccount(email: string, password: string, social = false): MockAccount {
  const acc: MockAccount = { email: norm(email), password, nickname: null, social };
  accounts.set(acc.email, acc);
  return acc;
}

/** 구글 로그인(목): 같은 계정을 계속 쓰되 첫 로그인에서는 닉네임이 비어 있다 */
export function socialAccount(email: string): MockAccount {
  return findAccount(email) ?? createAccount(email, "", true);
}

export function nicknameTaken(nickname: string): boolean {
  const v = nickname.trim();
  if (RESERVED.some((r) => r === v)) return true;
  return [...accounts.values()].some((a) => a.nickname === v);
}

export function setNickname(email: string, nickname: string): MockAccount | null {
  const acc = findAccount(email);
  if (!acc) return null;
  acc.nickname = nickname.trim();
  return acc;
}

/** 목 계정을 User 모양으로. 기존 목 사용자(me@ody.app)는 그대로 쓴다 */
export function accountAsUser(acc: MockAccount) {
  return { ...mockMe(), email: acc.email === MOCK_ME_EMAIL ? MOCK_ME_EMAIL : acc.email, name: null, nickname: acc.nickname };
}
