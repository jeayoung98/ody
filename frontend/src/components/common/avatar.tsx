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
        /*
          **바깥 원에 못으로 박는다** (S15P21A405-575). 전에는 `h-full w-full` 만 줬는데,
          부모가 `display: grid` 라 **퍼센트 높이가 자동 트랙에 걸려 제 구실을 못 했다** —
          트랙 높이가 사진 때문에 정해지고, 그 트랙에 다시 100% 를 맞추니 사진 비율이 그대로
          남는다. 100x400 사진을 64px 아바타에 넣으면 바깥 span 은 64x64 인데 **img 가
          64x256** 이었다 (실측).
          그러면 `object-cover` 도 소용이 없다 — 자를 상자가 이미 길어진 뒤라 잘릴 것이 없다.
          그 긴 상자에 `rounded-pill`(999px)이 걸려 **세로 타원**이 됐다.
          `absolute inset-0` 은 트랙이 아니라 **부모 상자**에 맞으므로 사진이 뭐든 64x64 다.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? ""}
          className="absolute inset-0 h-full w-full rounded-pill object-cover shadow-[inset_0_0_0_1px_rgba(255,255,255,.18)]"
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
