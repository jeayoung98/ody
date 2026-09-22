/**
 * 데모용 봇 명단 (S15P21A405-536).
 *
 * **봇인 것을 감추지 않는다.** 이름 끝에 `봇` 이 붙고 프사는 로봇 얼굴이다 — 시연에서 사람인
 * 척할 이유가 없고, 나중에 진짜 사용자가 늘었을 때 "저 사람 누구냐" 는 질문이 남으면 곤란하다.
 * 대신 **행동은 사람과 같다** — 곡을 고르고 겹을 옮기고 자리를 비우는 규칙은 `sim.ts` 가 판다.
 *
 * 이메일 도메인 하나가 봇의 신원이다. 서버로 나가면 안 되는 요청을 가려내는 자리마다
 * `isBot()` 한 줄만 본다 — 명단을 뒤지지 않으므로 명단이 바뀌어도 그 자리들은 그대로다.
 */

/** 실제 메일 도메인과 겹치지 않는다 — `.bot` 은 등록된 TLD 가 아니다 */
export const BOT_DOMAIN = "@ody.bot";

export const isBot = (email: string | null | undefined): boolean => !!email?.endsWith(BOT_DOMAIN);

export interface BotSeed {
  email: string;
  nickname: string;
  imageUrl: string;
  /** 시뮬레이션 난수의 출발점. 봇마다 다른 리듬을 갖게 한다 */
  seed: number;
}

/**
 * 로봇 얼굴 한 장. 색만 다르고 모양은 같다 — 한눈에 "같은 종류" 로 읽혀야 실사용자와 갈린다.
 *
 * 파일이 아니라 데이터 URI 인 이유는 배포에 이미지 여덟 장을 얹기 싫어서다. `<img src>` 가
 * 그대로 받는다 (`common/avatar` 는 next/image 가 아니라 순수 `img` 다).
 */
function face(hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" fill="hsl(${hue} 42% 16%)"/>
<line x1="32" y1="9" x2="32" y2="17" stroke="hsl(${hue} 70% 62%)" stroke-width="2.5"/>
<circle cx="32" cy="8" r="3.5" fill="hsl(${hue} 80% 66%)"/>
<rect x="15" y="17" width="34" height="30" rx="9" fill="hsl(${hue} 30% 26%)" stroke="hsl(${hue} 65% 58%)" stroke-width="2"/>
<circle cx="24" cy="30" r="4.2" fill="hsl(${hue} 85% 70%)"/>
<circle cx="40" cy="30" r="4.2" fill="hsl(${hue} 85% 70%)"/>
<rect x="24" y="38" width="16" height="3" rx="1.5" fill="hsl(${hue} 55% 48%)"/>
<rect x="9" y="26" width="4" height="11" rx="2" fill="hsl(${hue} 55% 44%)"/>
<rect x="51" y="26" width="4" height="11" rx="2" fill="hsl(${hue} 55% 44%)"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** 여덟 명. 늘리면 화면이 봇으로 뒤덮이고, 줄이면 겹이 갈릴 때 도로 비어 보인다 */
export const BOT_ROSTER: BotSeed[] = [
  ["노바봇", 188],
  ["루나봇", 265],
  ["오리온봇", 22],
  ["베가봇", 152],
  ["리라봇", 310],
  ["아틀라스봇", 205],
  ["카시오봇", 340],
  ["퀘이사봇", 88],
].map(([nickname, hue], i) => ({
  email: `bot-${i + 1}${BOT_DOMAIN}`,
  nickname: nickname as string,
  imageUrl: face(hue as number),
  // 이메일이 아니라 자리 번호로 시드를 만든다 — 명단 순서를 바꾸면 성격도 바뀌는 편이 자연스럽다
  seed: (i + 1) * 7919,
}));

export const botByEmail = (email: string): BotSeed | undefined => BOT_ROSTER.find((b) => b.email === email);
