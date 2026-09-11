import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

/**
 * 성능 측정 결과를 PERF-LOG.md 에 자동으로 덧붙이는 개발 전용 라우트 (S15P21A405-215).
 *
 * `scripts/perf-bench.js` 가 측정을 마치면 여기로 POST 한다. 사람이 콘솔 출력을 복사해
 * 붙여넣지 않아도 기록이 남는다.
 *
 * ⚠️ **개발 전용이다.** 파일을 쓰는 엔드포인트가 배포 서버에 열려 있으면 안 되므로
 *    프로덕션에서는 404 를 돌려준다. 쓰는 파일도 PERF-LOG.md 하나로 고정해
 *    경로를 요청으로 바꿀 수 없게 한다.
 *
 * 목 API(`src/app/api/`)는 백엔드가 붙으면 통째로 사라지므로 이 라우트는 그 바깥에 둔다.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 표 행과 상세 블록을 끼워 넣을 자리. PERF-LOG.md 의 주석 마커와 맞춘다 */
const ROW_MARK = "<!-- /PERF_ROWS -->";
const DETAIL_MARK = "<!-- /PERF_DETAILS -->";

const isProd = process.env.NODE_ENV === "production";

/** 기록 파일은 하나로 고정한다 — 요청으로 경로를 바꿀 수 없다 */
const LOG_PATH = path.join(process.cwd(), "PERF-LOG.md");

const notFound = () => new NextResponse("Not Found", { status: 404 });

export async function POST(req: Request) {
  if (isProd) return notFound();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON 파싱 실패" }, { status: 400 });
  }

  const { row, detail, summary, markdown } = (body ?? {}) as {
    row?: unknown;
    detail?: unknown;
    summary?: unknown;
    markdown?: unknown;
  };

  if (typeof row !== "string" || !row.trim().startsWith("|")) {
    return NextResponse.json({ ok: false, error: "row 는 '|' 로 시작하는 표 한 줄이어야 한다" }, { status: 400 });
  }
  if (detail == null || typeof detail !== "object") {
    return NextResponse.json({ ok: false, error: "detail 객체가 필요하다" }, { status: 400 });
  }

  // 줄바꿈이 섞이면 표가 깨진다 — 한 줄로 강제한다
  const safeRow = row.replace(/[\r\n]+/g, " ").trim();
  const title = typeof summary === "string" && summary.trim() ? summary.trim().slice(0, 120) : new Date().toISOString();

  let md: string;
  try {
    md = await fs.readFile(LOG_PATH, "utf8");
  } catch {
    return NextResponse.json({ ok: false, error: `PERF-LOG.md 를 못 읽었다: ${LOG_PATH}` }, { status: 500 });
  }

  if (!md.includes(ROW_MARK) || !md.includes(DETAIL_MARK)) {
    return NextResponse.json(
      { ok: false, error: `PERF-LOG.md 에 마커(${ROW_MARK} / ${DETAIL_MARK})가 없다` },
      { status: 500 },
    );
  }

  // 사람이 읽는 건 마크다운 표, 재분석용 원본 JSON 은 그 아래 한 겹 더 접어둔다
  const human = typeof markdown === "string" && markdown.trim() ? `${markdown.trim()}\n\n` : "";
  const detailBlock =
    `<details><summary>${title}</summary>\n\n` +
    human +
    "<details><summary>원본 JSON</summary>\n\n" +
    "```json\n" +
    `${JSON.stringify(detail, null, 2)}\n` +
    "```\n\n" +
    "</details>\n\n" +
    "</details>\n\n";

  const next = md.replace(ROW_MARK, `${safeRow}\n${ROW_MARK}`).replace(DETAIL_MARK, `${detailBlock}${DETAIL_MARK}`);

  try {
    await fs.writeFile(LOG_PATH, next, "utf8");
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `PERF-LOG.md 쓰기 실패: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, file: LOG_PATH, appended: safeRow });
}

/** 스크립트가 "자동 기록이 가능한 환경인가"를 먼저 물어볼 때 쓴다 */
export async function GET() {
  if (isProd) return notFound();
  const exists = await fs
    .access(LOG_PATH)
    .then(() => true)
    .catch(() => false);
  return NextResponse.json({ ok: true, logExists: exists, file: LOG_PATH });
}
