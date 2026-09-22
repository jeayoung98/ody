/**
 * 봇이 고를 만한 **아는 가수** (S15P21A405-543).
 *
 * 상주 집합에서 무작위로 고르면 662만 곡짜리 카탈로그라 아무도 모르는 곡만 나온다. 시연에서
 * "누가 이 곡을 듣고 있다" 를 보여 줄 때 아는 곡이어야 사람으로 읽힌다.
 *
 * **한글과 로마자를 둘 다 넣는다.** 백엔드 카탈로그가 가수 이름을 어느 쪽으로 들고 있는지
 * 확인하지 못했다 — 배포 API 가 인증을 요구해서 목록을 못 떠 봤다. 어느 쪽이든 걸리게 둔다.
 *
 * 명단에 맞는 곡이 그 겹에 없으면 **부르는 쪽이 평소대로 고른다** (`use-bots` 의 `pickSong`).
 * 여기서 빈 목록을 돌려주는 것이 곧 "아무도 안 보임" 이 되면 안 된다.
 */

/** 이름 하나가 곧 한 가수다. 같은 가수의 다른 표기는 각각 한 줄로 둔다 */
const NAMES = [
  // 솔로
  "아이유", "IU", "태연", "TAEYEON", "박효신", "성시경", "임영웅", "폴킴", "Paul Kim",
  "백예린", "Yerin Baek", "헤이즈", "Heize", "크러쉬", "Crush", "딘", "DEAN",
  "자이언티", "Zion.T", "이무진", "정승환", "이선희", "조용필", "이문세", "김광석", "신승훈",
  "지코", "ZICO", "선미", "SUNMI", "청하", "CHUNG HA", "비", "Rain", "박재범", "Jay Park",
  // 그룹 — 아이돌
  "방탄소년단", "BTS", "블랙핑크", "BLACKPINK", "뉴진스", "NewJeans", "아이브", "IVE",
  "에스파", "aespa", "르세라핌", "LE SSERAFIM", "세븐틴", "SEVENTEEN", "트와이스", "TWICE",
  "레드벨벳", "Red Velvet", "빅뱅", "BIGBANG", "소녀시대", "Girls' Generation", "엑소", "EXO",
  "샤이니", "SHINee", "있지", "ITZY", "스트레이 키즈", "Stray Kids", "마마무", "MAMAMOO",
  "오마이걸", "OH MY GIRL", "여자친구", "GFRIEND", "에이핑크", "Apink", "2NE1", "원더걸스",
  "Wonder Girls", "NCT", "몬스타엑스", "MONSTA X", "(여자)아이들", "(G)I-DLE",
  // 밴드·인디
  "볼빨간사춘기", "BOL4", "악동뮤지션", "AKMU", "잔나비", "JANNABI", "10CM", "멜로망스",
  "MeloMance", "혁오", "HYUKOH", "검정치마", "The Black Skirts", "새소년", "SE SO NEON",
  "넬", "NELL", "데이식스", "DAY6", "쏜애플", "국카스텐", "장범준", "버스커 버스커",
] as const;

/**
 * 견줄 수 있는 꼴로 다듬는다 — 소문자, 공백·기호 제거.
 *
 * `(여자)아이들` 처럼 괄호가 든 이름이 있고, 표기도 `Girls' Generation` / `girls generation`
 * 처럼 흔들린다. 기호를 다 털면 그 흔들림이 사라진다.
 */
export function normalizeArtist(name: string): string {
  return name.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

const KNOWN = new Set(NAMES.map(normalizeArtist));

/**
 * 한 곡의 가수 표기에서 **가수 하나하나**를 떼어낸다.
 *
 * `IU feat. SUGA` · `아이유, 박효신` · `Crush X Zion.T` 처럼 여럿이 한 칸에 들어온다.
 * 통째로 견주면 하나도 안 맞고, 그렇다고 부분 일치로 두면 `IU` 가 `Iumumble` 에도 걸린다 —
 * 잘라서 **각각 정확히** 견주는 것이 두 함정을 다 피하는 길이다.
 */
export function artistParts(artist: string): string[] {
  return artist
    .split(/,|&|\/|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bvs\.?\b|\bx\b/i)
    .map(normalizeArtist)
    .filter(Boolean);
}

/** 이 곡이 아는 가수의 곡인가 */
export function isKnownArtist(artist: string | null | undefined): boolean {
  if (!artist) return false;
  return artistParts(artist).some((p) => KNOWN.has(p));
}
