import type { ReactNode } from "react";

/** .note — 패널 안 보조 설명 문장 */
export default function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-ink-3 [&_b]:font-medium [&_b]:text-ink">{children}</p>;
}
