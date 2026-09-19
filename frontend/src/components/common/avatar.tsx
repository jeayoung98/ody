interface AvatarProps {
  src: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  /** 온라인 상태 점 표시 */
  online?: boolean | null;
}

/** .av — 이미지가 없으면 그라데이션 원 + 이니셜 (프로토타입 마이페이지 아바타) */
export default function Avatar({ src, name, size = 30, online = null }: AvatarProps) {
  const initial = (name ?? "?").trim().slice(0, 2).toUpperCase();
  return (
    <span className="relative inline-grid shrink-0 place-items-center rounded-pill" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? ""}
          className="h-full w-full rounded-pill object-cover shadow-[inset_0_0_0_1px_rgba(255,255,255,.18)]"
        />
      ) : (
        <span
          className="grid h-full w-full place-items-center rounded-pill font-display font-semibold text-[#04121a]"
          style={{ fontSize: size * 0.36, background: "linear-gradient(140deg,#4fe3ce,#a67cff)" }}
        >
          {initial}
        </span>
      )}
      {online != null && (
        <span
          className={`absolute -right-px -bottom-px rounded-pill ${online ? "bg-teal shadow-[0_0_0_2px_#05080f,0_0_8px_#4fe3ce]" : "bg-ink-4 shadow-[0_0_0_2px_#05080f]"}`}
          style={{ width: Math.max(8, size * 0.3), height: Math.max(8, size * 0.3) }}
        />
      )}
    </span>
  );
}
