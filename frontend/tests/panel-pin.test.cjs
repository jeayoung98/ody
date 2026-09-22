/* eslint-disable @typescript-eslint/no-require-imports */
// 주변 사람을 보는 동안 지도 클릭이 패널을 갈아타지 않는다 (S15P21A405-515).
// 규칙이 세 갈래(펼침/접힘/닫힘)라 말로만 두면 다음에 누가 한 갈래를 지운다.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { usePanelStore } = require("../src/stores/use-panel-store.ts");

const panel = () => usePanelStore.getState();

beforeEach(() => usePanelStore.setState(usePanelStore.getInitialState(), true));

test("주변 사람을 펼쳐 두면 지도에서 곡을 눌러도 패널이 그대로다", () => {
  panel().openFriends();
  panel().openSongFromMap(42);

  assert.equal(panel().activePanel, "friends", "레이더를 보면서 곡만 바꾸는 것이 이 화면의 쓰임이다");
  assert.equal(panel().musicId, null, "상세 대상도 잡지 않는다");
});

test("접어 두면 상세를 열되 돌아갈 자리로 주변 사람을 남긴다", () => {
  panel().openFriends();
  panel().toggleCollapsed();
  assert.equal(panel().snap, 1, "데스크톱 손잡이는 1(접힘) 과 3(펼침) 을 오간다");

  panel().openSongFromMap(42);
  assert.equal(panel().activePanel, "song");
  assert.equal(panel().musicId, 42);
  assert.deepEqual(panel().back, { panel: "friends" }, "접기는 잠깐 치우기라 돌아갈 길이 있어야 한다");

  panel().goBack();
  assert.equal(panel().activePanel, "friends");
  assert.equal(panel().back, null);
});

test("주변 사람을 닫았으면 예전처럼 상세가 뜬다", () => {
  panel().openFriends();
  panel().close();
  panel().openSongFromMap(42);

  assert.equal(panel().activePanel, "song");
  assert.equal(panel().musicId, 42);
  assert.equal(panel().back, null, "지도에서 바로 연 상세에는 돌아갈 자리가 없다");
});

test("다른 패널에서는 지도 클릭이 예전 그대로 상세로 간다", () => {
  panel().openChart();
  panel().openSongFromMap(7);
  assert.equal(panel().activePanel, "song");
  assert.equal(panel().musicId, 7);
});

test("지도를 끌어도 주변 사람은 접히지 않는다 — 다른 패널은 접힌다", () => {
  panel().openFriends();
  panel().collapse();
  assert.notEqual(panel().snap, 1, "지도를 움직이며 같이 보는 화면이다");

  panel().openChart();
  panel().collapse();
  assert.equal(panel().snap, 1, "나머지는 지도에 자리를 비켜 준다");
});
