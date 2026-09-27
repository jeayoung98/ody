/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **기능 표시는 설문 모드를 보지 않는다** (S15P21A405-612).
 *
 * 설문 모드로 랭킹을 감추자(S15P21A405-570) 콘테스트가 딸려 꺼졌다. 이제 그 모드는 설문만
 * 가르고, 기능 표는 하나뿐이다 — 설문 모드용 표가 다시 생기면 이 파일이 먼저 깨진다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const features = require("../src/constants/features.ts");

test("기능 표는 하나다 — 설문 모드용 표가 없다", () => {
  assert.deepEqual(Object.keys(features).sort(), ["FEATURES", "PANEL_ENABLED"]);
});

/**
 * **지금 일부러 꺼 둔 것.** 여기 적히지 않은 기능이 꺼지면 아래 테스트가 깨진다 —
 * 결정해서 끈 것과 실수로 꺼진 것을 가르는 자리다. 다시 켤 때 이 줄도 같이 지운다.
 */
const INTENTIONALLY_OFF = {
  /** S15P21A405-636 — 더블클릭 바로재생 안내를 잠깐 내려 뒀다. 컴포넌트는 그대로 있다 */
  playHint: true,
};

test("정해 둔 것 말고는 전부 켜져 있다", () => {
  for (const [k, v] of Object.entries(features.FEATURES)) {
    if (INTENTIONALLY_OFF[k]) {
      assert.equal(v, false, `${k} 는 꺼 두기로 한 것인데 켜져 있다 — 되돌렸으면 INTENTIONALLY_OFF 에서도 지운다`);
      continue;
    }
    assert.equal(v, true, `${k} 가 꺼져 있다`);
  }
  // 패널은 하나도 안 꺼져 있다. 꺼야 할 일이 생기면 위처럼 이유를 적고 목록에 올린다
  for (const [k, v] of Object.entries(features.PANEL_ENABLED)) assert.equal(v, true, `${k} 패널이 꺼져 있다`);
});
