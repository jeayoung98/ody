import { genreColor } from "@/constants/design-tokens";

/**
 * 앨범 커버 한 칸.
 *
 * **실제 커버 이미지는 아직 어느 응답에도 안 들어온다.** `albumCoverUrl` 은 ERD 에 없는 필드라
 * 지금은 늘 비어 있고, 그동안은 장르색 그라데이션에 ♪ 를 얹어 자리를 지킨다.
 * 백엔드가 커버를 주기 시작하면 **이 파일은 그대로 두고** 쓰는 쪽에서 `coverUrl` 만 넘기면 된다 —
 * 곡 상세도 설문도 같은 것을 쓰므로 한 번에 따라온다.
 */
interface AlbumCoverProps {
  /** 실제 커버 주소. 없으면 장르색으로 대신 채운다 */
  coverUrl?: string | null;
  /** 커버가 없을 때 깔 색. 모르면 중립색 */
  genreId?: number | null;
  alt?: string;
  /** 한 변 px */
  size?: number;
  className?: string;
}

export default function AlbumCover({ coverUrl, genreId, alt = "", size = 56, className = "" }: AlbumCoverProps) {
  const base = genreId == null ? "#12203c" : genreColor(genreId);
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden text-ink/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)] ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.16),
        fontSize: Math.round(size * 0.36),
        background: coverUrl ? undefined : `linear-gradient(140deg,${base},#13102a)`,
      }}
    >
      {coverUrl ? (
        // 원본 크기를 모르고 외부 주소라 next/image 의 최적화가 걸리지 않는다
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt={alt} className="h-full w-full object-cover" />
      ) : (
        "♪"
      )}
    </span>
  );
}
