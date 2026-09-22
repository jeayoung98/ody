/**
 * 데모용 봇 명단 (S15P21A405-536).
 *
 * **봇인 것은 이름에서만 드러난다.** 끝에 `봇` 이 붙는다 — 시연에서 사람인 척할 이유가 없고,
 * 나중에 진짜 사용자가 늘었을 때 "저 사람 누구냐" 는 질문이 남으면 곤란하다. 그 밖에는
 * 전부 사람과 같다 — 프사도, 곡을 고르고 겹을 옮기고 자리를 비우는 규칙(`sim.ts`)도.
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
 * 프사 한 장. **여덟 장이 다 다르다** — 색도 무늬도 겹치지 않는다.
 *
 * 로봇 그림이 아니다. 봇이라는 것은 이름이 말하고 있고, 프사까지 같은 그림으로 찍어 두면
 * 목록에서 누가 누구인지 구분이 안 된다 — 여덟 줄이 전부 같은 얼굴이 되어 오히려 한 명처럼
 * 보인다. 사람이 아직 프사를 안 올렸을 때 서비스가 만들어 주는 그림에 가깝게 뒀다.
 *
 * **30px 에서도 갈려야 한다.** 목록 줄의 아바타가 그 크기라 세밀한 무늬는 뭉개진다 — 그래서
 * 색 두 개와 큼직한 덩어리 하나로만 가른다.
 *
 * 파일이 아니라 데이터 URI 인 이유는 배포에 이미지 여덟 장을 얹기 싫어서다. `<img src>` 가
 * 그대로 받는다 (`common/avatar` 는 next/image 가 아니라 순수 `img` 다).
 */
function portrait(hue: number, i: number): string {
  const far = (hue + 48 + ((i * 23) % 40)) % 360;
  const cx = 18 + ((i * 37) % 30);
  const cy = 16 + ((i * 53) % 30);
  const r = 17 + ((i * 29) % 15);
  /**
   * **`width`·`height` 를 빼면 안 된다.** `<img>` 는 CSS 크기로 그려 주지만, 캔버스
   * (`drawImage`)는 이미지의 **고유 크기**를 본다 — `viewBox` 만 있는 SVG 는 그 값이 0 이라
   * 헬멧 바이저 안이 새까맣게 나온다. 눈으로 목록만 보면 멀쩡해 보여서 찾기 어려운 함정이다.
   */
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue} 62% 46%)"/><stop offset="1" stop-color="hsl(${far} 58% 30%)"/>
</linearGradient></defs>
<rect width="64" height="64" fill="url(#g)"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="hsl(${far} 80% 72%)" opacity=".42"/>
<circle cx="${64 - cx}" cy="${64 - cy}" r="${r * 0.55}" fill="hsl(${hue} 90% 80%)" opacity=".3"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * 팀원 여섯 명. 늘리면 화면이 봇으로 뒤덮이고, 줄이면 겹이 갈릴 때 도로 비어 보인다.
 *
 * 색은 서로 멀찍이 떨어뜨려 뒀다 — 목록에서 프사만 보고도 누가 누구인지 갈려야 한다.
 */
export const BOT_ROSTER: BotSeed[] = (
  [
    // 닉네임 · 색 · `public/bots/` 안의 사진 파일 (없으면 위에서 만든 그림을 쓴다)
    ["주하봇", 188, "juha-quokka.jpg"],
    ["재영봇", 268, null],
    ["지원봇", 22, null],
    ["효정봇", 322, null],
    ["유진봇", 148, null],
    ["준서봇", 45, null],
  ] as const
).map(([nickname, hue, photo], i) => ({
  email: `bot-${i + 1}${BOT_DOMAIN}`,
  nickname,
  /**
   * **사진 파일이 있으면 그것을 쓴다.** 없는 파일을 가리키면 목록에 깨진 이미지가 뜨므로,
   * 파일을 넣은 봇만 위 표에 이름을 적는다 — 넣는 방법은 `public/bots/README.md` 에 있다.
   */
  imageUrl: photo ? `/bots/${photo}` : portrait(hue, i),
  // 이메일이 아니라 자리 번호로 시드를 만든다 — 명단 순서를 바꾸면 성격도 바뀌는 편이 자연스럽다
  seed: (i + 1) * 7919,
}));

export const botByEmail = (email: string): BotSeed | undefined => BOT_ROSTER.find((b) => b.email === email);
