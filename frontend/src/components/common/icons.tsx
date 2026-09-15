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
export const RadarIcon = ({ size = 15, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 3v4.5M12 12l5.5-5.5" />
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
