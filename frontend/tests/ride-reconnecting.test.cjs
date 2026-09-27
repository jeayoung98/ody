/* eslint-disable @typescript-eslint/no-require-imports */
// 인솔자와 끊겨 다시 잇는 동안 배너가 "탑승 중" 이라 말하지 않게 (S15P21A405-700).
// 인솔자가 창을 닫으면 우주선은 곧 사라지는데, 다시 타 보는 약 45초 동안 배너만 "탑승 중" 으로 남았다.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { useFollowStore } = require("../src/stores/use-follow-store.ts");
const { resumeRide, cancelResume } = require("../src/lib/realtime/ride-resume.ts");
const { ApiError } = require("../src/lib/api.ts");

const target = { email: "L@ody.kr", nickname: "쥬디", imageUrl: null };
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  cancelResume();
  useFollowStore.getState().stop();
  useFollowStore.getState().start({ email: target.email, nickname: target.nickname, imageUrl: null, musicId: 1, snapshotSeq: 0 });
});

test("다시 타기에 한 번 실패하면 재연결 중이 된다", async () => {
  resumeRide(target, () => Promise.reject(new ApiError(422, "PRESENCE_ERROR", "x")), () => {});
  await flush();
  assert.equal(useFollowStore.getState().reconnecting, true);
  cancelResume();
});

test("다시 타면 재연결 중이 풀린다", async () => {
  useFollowStore.getState().setReconnecting(true);
  resumeRide(target, () => Promise.resolve(), () => {});
  await flush();
  assert.equal(useFollowStore.getState().reconnecting, false);
});

test("서버가 아직 태우고 있으면 재연결 중이 풀린다", async () => {
  useFollowStore.getState().setReconnecting(true);
  resumeRide(target, () => Promise.reject(new ApiError(409, "RIDE_ALREADY_RIDING", "x")), () => {});
  await flush();
  assert.equal(useFollowStore.getState().reconnecting, false);
});

test("내리면(stop) 재연결 중도 지워진다 — 다음 탑승이 끊긴 상태로 시작하지 않는다", () => {
  useFollowStore.getState().setReconnecting(true);
  useFollowStore.getState().stop();
  assert.equal(useFollowStore.getState().reconnecting, false);
});
