import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size: number, props: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

/** 프로토타입에서 쓰인 라인 아이콘 세트 */
export const SearchIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.2}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4.2-4.2" />
  </svg>
);
/** 마우스와 휠 — 튜토리얼 1단계가 "휠을 굴리세요" 하고 띄우는 그림 (S15P21A405-351) */
export const MouseWheelIcon = ({ size = 40, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={1.5}>
    <rect x="7" y="2" width="10" height="20" rx="5" />
    <path d="M12 6.5v3" />
  </svg>
);
/** 내 위치로 가기 — 지도 앱의 "현재 위치" 조준선 */
export const LocateIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="6.2" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <path d="M12 1.8v3.2M12 19v3.2M1.8 12h3.2M19 12h3.2" />
  </svg>
);
export const CloseIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const BackIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.2}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const FriendsIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.2 19c.5-3.3 3-5.2 5.8-5.2s5.3 1.9 5.8 5.2" />
    <circle cx="17.5" cy="9.5" r="2.4" />
    <path d="M16 14.4c2.5.1 4.3 1.9 4.8 4.6" />
  </svg>
);
export const JourneyIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="5.5" cy="18.5" r="2.4" />
    <circle cx="18.5" cy="5.5" r="2.4" />
    <path d="M7.6 16.8C11 14 9 10.5 12.4 7.6" />
  </svg>
);
export const RankIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 20V12M12 20V5M19 20v-6" />
  </svg>
);
export const UserIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c.8-3.8 3.9-6 7.5-6s6.7 2.2 7.5 6" />
  </svg>
);
export const PlayIcon = ({ size = 14, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M8 5v14l11-7z" />
  </svg>
);
export const PauseIcon = ({ size = 14, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
  </svg>
);
export const PrevIcon = ({ size = 14, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M7 5h2v14H7zM20 5v14l-10-7z" />
  </svg>
);
export const NextIcon = ({ size = 14, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M15 5h2v14h-2zM4 5l10 7-10 7z" />
  </svg>
);
/**
 * 주변 탐색 — **한 별에서 이웃들로 뻗는 코로나** (S15P21A405-384).
 *
 * 예전 레이더(동심원 + 대각선)는 "훑어본다" 는 뜻이라 이 기능과 어긋났다. 여기서 하는 일은
 * **한 곡을 가운데 두고 가까운 곡들을 불러 세우는 것**이다 — 가운데 별에서 짧은 선이 방사로
 * 뻗고 끝마다 이웃 별이 붙는 그림이 그 뜻이다. 곡 상세 카드 줄과 하단 바가 같은 것을 쓴다.
 */
export const CoronaIcon = ({ size = 15, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={1.7}>
    <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    <path d="M12 6.4V4M12 20v-2.4M6.4 12H4M20 12h-2.4M8.1 8.1 6.4 6.4M15.9 15.9l1.7 1.7M15.9 8.1l1.7-1.7M8.1 15.9l-1.7 1.7" />
    <circle cx="12" cy="2.9" r="1.05" />
    <circle cx="12" cy="21.1" r="1.05" />
    <circle cx="2.9" cy="12" r="1.05" />
    <circle cx="21.1" cy="12" r="1.05" />
  </svg>
);
export const SmileIcon = ({ size = 19, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={1.8}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14.5c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2" />
    <circle cx="9" cy="9.6" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="9.6" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);
export const HelpIcon = ({ size = 17, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.8 2.1c-.9.6-1.3 1.1-1.3 2.1" />
    <circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * 신고 — 깃발. 곡이 음원이 아닐 때 알리는 자리에 쓴다 (S15P21A405-378).
 *
 * 경고 삼각형(⚠)을 쓰지 않았다. 그건 "이 화면에 문제가 있다" 는 신호라, 사용자가 **스스로
 * 누르는 입구**에 놓으면 앱이 고장 난 것처럼 읽힌다. 깃발은 "여기 표시해 둔다" 쪽이다.
 */
export const FlagIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 21V4" />
    <path d="M5 4h11l-2.2 3.6L16 11H5" />
  </svg>
);
/** 왼쪽 홑화살. 오른쪽은 `rotate-180` 으로 돌려 쓴다 (`ChevronDownIcon` 과 같은 이유) */
export const ChevronLeftIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.1}>
    <path d="M14.5 6l-6 6 6 6" />
  </svg>
);
/**
 * 아래로 향하는 홑화살 — 접힌 것을 편다. **펴진 상태는 뒤집어서 쓴다**(`rotate-180`):
 * 아이콘을 둘로 나누면 바뀌는 순간 튀어서, 한 아이콘을 돌려야 애니메이션이 이어진다.
 */
export const ChevronDownIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.1}>
    <path d="M6 9.5l6 6 6-6" />
  </svg>
);
/**
 * 플레이리스트에 추가 (SONG-05) — 목록 세 줄 + 더하기.
 * 하트를 쓰지 않았다. 하트는 "좋아요"(PATH-07)의 자리라 같은 화면에서 뜻이 갈린다.
 */
export const PlaylistAddIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 7h12M4 12h12M4 17h6.5" />
    <path d="M17 14.2v6M14 17.2h6" />
  </svg>
);
/**
 * 여정 출발 — 별에서 떠나는 화살. 도착(`ArriveIcon`)과 짝이고, 색은 여정 패널과 같게
 * 출발 teal · 도착 violet 로 쓴다 (`journey-endpoints.tsx`).
 */
export const DepartIcon = ({ size = 13, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="6.4" cy="17.6" r="3.1" />
    <path d="M9.9 14.1 18 6" />
    <path d="M12.6 6H18v5.4" />
  </svg>
);
/** 여정 도착 — 별로 들어오는 화살 */
export const ArriveIcon = ({ size = 13, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="17.6" cy="17.6" r="3.1" />
    <path d="M6 6l7.4 7.4" />
    <path d="M8.8 13.4h4.6V8.8" />
  </svg>
);
/**
 * 신고 — 경광등(삐용삐용). 깃발보다 "무슨 일이 있었다" 는 뜻이 바로 읽힌다 (S15P21A405-384).
 * 받침 · 돔 · 위로 뻗는 빛 두 줄.
 *
 * 색은 쓰는 쪽에서 준다(`currentColor`). 헤더 신고 버튼은 빨강이다 — 402 가 본문에 빨간 버튼을
 * 세운 뜻("눌러야 할 것이 아니라 **눈에 띄어야** 하는 버튼")을 색으로 가져왔다.
 * 다른 아이콘보다 큰 기본값(18)을 쓴다. 작으면 돔·빛줄기가 뭉쳐 그냥 점으로 보인다.
 */
export const SirenIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M7.6 18.6v-3.4a4.4 4.4 0 0 1 8.8 0v3.4" />
    <path d="M5.2 18.6h13.6" />
    <path d="M12 8.6V6.4" />
    <path d="M6.3 11.5 4.2 10.3M17.7 11.5l2.1-1.2" />
  </svg>
);
