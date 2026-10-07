/* eslint-disable @typescript-eslint/no-require-imports */
// 지도를 통째로 덮은 화면 수 (S15P21A405-737).
//
// 덮은 화면이 하나라도 있으면 지도는 그리기를 쉰다. 화면이 바뀔 때 붙고 떨어지는 순서에 기대지
// 않으려고 개수로 센다 — 참·거짓 하나였다면 새 화면이 먼저 붙고 옛 화면이 나중에 떨어지는 순서에서
// 덮인 것이 지워져, 탭 화면 뒤에서 지도가 다시 매 프레임 그려지기 시작한다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { useMapCoverStore } = require("../src/stores/use-map-cover-store.ts");

const covers = () => useMapCoverStore.getState().covers;
const reset = () => useMapCoverStore.setState({ covers: 0 });

test("탭 화면을 옮겨 다닐 때 새 화면이 먼저 붙어도 덮인 채로 남는다", () => {
  reset();
  const { cover, uncover } = useMapCoverStore.getState();
  cover(); // 랭킹
  cover(); // 마이페이지가 먼저 붙고
  uncover(); // 랭킹이 나중에 떨어진다
  assert.equal(covers(), 1, "마이페이지가 아직 덮고 있다");
  uncover(); // 지도로 돌아옴
  assert.equal(covers(), 0);
});

test("떼는 쪽이 더 많아도 음수로 내려가지 않는다", () => {
  reset();
  useMapCoverStore.getState().uncover();
  assert.equal(covers(), 0);
  useMapCoverStore.getState().cover();
  assert.equal(covers(), 1, "음수에 갇히지 않고 한 번 덮으면 바로 덮인 것으로 읽힌다");
});
