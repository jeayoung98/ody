import type { ReactNode } from "react";

/**
 * .note — 패널 안 보조 설명 문장.
 *
 * 굵은 글씨(`<b>`)는 **섹션 제목과 같은 밝기(ink-2)** 다 (S15P21A405-384). 예전에는 제일 밝은
 * ink 였는데, 보조 설명 속 낱말이 그 칸의 제목보다 밝아서 눈이 먼저 그리로 갔다.
 */
export default function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-ink-3 [&_b]:font-medium [&_b]:text-ink-2">{children}</p>;
}
