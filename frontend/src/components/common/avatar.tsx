"use client";

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
      {/*
        **이니셜을 항상 깔아 둔다** (S15P21A405-593). 사진은 그 위에 덮이고, 못 뜨면 스스로
        숨어서 이 원이 드러난다. 예전에는 주소가 있으면 `<img>` 만 그렸는데, 로드가 실패하면
        브라우저가 **깨진 아이콘과 `alt` 글자**를 그 자리에 그렸다 — 이름이 길면 두 줄이 되어
        원 밖으로 흘러내렸다. 575 가 상자 크기는 잡았지만 글자까지 잡지는 못했다.
      */}
      <span
        aria-hidden={src ? true : undefined}
        className="grid h-full w-full place-items-center rounded-pill font-display font-semibold text-[#04121a]"
        style={{ fontSize: size * 0.36, background: "linear-gradient(140deg,#4fe3ce,#a67cff)" }}
      >
        {initial}
      </span>
      {src && (
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
          /*
            **`Referer` 를 안 보낸다** (S15P21A405-593). 구글 프로필 사진
            (`lh3.googleusercontent.com`)이 그 헤더를 보고 막는다 — 같은 주소를 나란히 재 보면
            기본값은 실패(`naturalWidth 0`)하고 `no-referrer` 는 96x96 으로 뜬다.
            우리가 잃는 것은 없다. 남의 서버에 우리 주소를 알릴 이유가 없다.
          */
          referrerPolicy="no-referrer"
          /* 그래도 못 뜨면 스스로 비켜 준다 — 뒤에 깔린 이니셜 원이 드러난다 */
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="absolute inset-0 h-full w-full rounded-pill object-cover shadow-[inset_0_0_0_1px_rgba(255,255,255,.18)]"
        />
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
