/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * `100vh` · `100vw` 가 다시 들어오지 못하게 막는다 (S15P21A405-420).
 *
 * **모바일 브라우저에서 `100vh` 는 지금 보이는 높이가 아니다.** 주소창이 접혔다 펴지는데
 * `vh` 는 접힌 상태(가장 큰 높이)로 고정이라, 주소창이 펴져 있으면 그만큼 화면 아래로 넘친다.
 * 패널 맨 밑 버튼이 안 보이거나 안 눌리는 식으로 나타난다.
 *
 * `dvh` 는 **지금 실제로 보이는 높이**라 주소창이 움직이면 같이 움직인다.
 *
 * 문법 검사가 아니라 **문자열 검사**다. 이 값은 컴포넌트의 Tailwind 임의값(대괄호 안의 calc)
 * 안에 들어 있어서 CSS 파서로는 안 잡힌다.
 *
 * **여기에 금지 문자열을 예시로 적지 않는다.** Tailwind 4 는 프로젝트 전체를 훑어 대괄호
 * 임의값처럼 생긴 문자열이면 주석에서도 클래스를 만들어 낸다. 실제로 이 주석에 예시를 적었더니
 * 쓰는 곳이 없는데도 빌드 CSS 에 그 규칙이 실려 나갔다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.resolve(__dirname, "../src");
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

/** `100vh` `100vw` 만 잡는다. `100dvh` `100svh` 는 통과 — 그게 옳은 쪽이다 */
const BANNED = /(?<![a-z])100v[hw]\b/;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

test("src 에 100vh·100vw 가 없다 — 모바일에서 주소창만큼 어긋난다", () => {
  const hits = [];
  for (const file of walk(SRC)) {
    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (BANNED.test(line)) hits.push(`${path.relative(SRC, file)}:${i + 1}  ${line.trim().slice(0, 90)}`);
      });
  }
  assert.deepEqual(hits, [], `100vh/100vw 를 dvh/dvw 로 바꾼다:\n${hits.join("\n")}`);
});
