"use client";

import type { ComponentProps } from "react";
import { useToastStore } from "@/stores/use-toast-store";
import Button from "./button";

type GuardedButtonProps = ComponentProps<typeof Button> & {
  /** 못 누르는 까닭. 있으면 버튼이 꺼지고, 눌러 보면 이 말을 토스트로 한다 */
  blocked?: string | null;
};

/**
 * **꺼져 있어도 왜 안 되는지 말하는 버튼** (S15P21A405-702).
 *
 * 꺼진 버튼은 브라우저가 클릭을 아예 안 보내서, 눌러 봐도 아무 일도 없고 까닭도 모른다. 그래서 버튼은 끈 채로
 * 클릭을 감싸는 자리가 받게 두고(`pointer-events-none`), 받은 자리에서 까닭을 토스트로 알린다.
 */
export default function GuardedButton({ blocked, className = "", ...props }: GuardedButtonProps) {
  const toast = useToastStore((s) => s.show);
  if (!blocked) return <Button className={className} {...props} />;
  return (
    <span role="presentation" className="inline-flex cursor-not-allowed" onClick={() => toast(blocked)}>
      <Button {...props} disabled className={`pointer-events-none ${className}`} />
    </span>
  );
}
