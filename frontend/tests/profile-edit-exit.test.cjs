/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 내 정보 수정이 **재생을 끊지 않는가** (S15P21A405-672).
 *
 * 이건 눈으로 봐선 잘 안 잡힌다 — 팝업은 멀쩡히 뜨고 저장도 되는데, 라우팅 한 줄이 남아 있으면
 * 저장하는 순간 지도와 플레이어가 통째로 다시 서고 듣던 곡만 조용히 끊긴다. 그래서 수치가 아니라
 * **경로가 남아 있는지**를 묶는다. 렌더 테스트 환경이 없어 소스를 읽는 방식이다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (p) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");

const MENU = "src/components/panels/feed/feed-menu.tsx";
const FORM = "src/components/auth/profile-edit-form.tsx";
const DIALOG = "src/components/auth/profile-edit-dialog.tsx";

test("마이페이지 메뉴는 프로필 경로로 넘어가지 않는다 — /profile 은 APP_ROUTES 밖이라 지도가 내려간다", () => {
  const menu = read(MENU);
  assert.ok(!menu.includes("ROUTES.profile"), "메뉴가 다시 /profile 로 라우팅하고 있다");
  assert.ok(menu.includes("ProfileEditDialog"), "메뉴가 팝업을 열지 않는다");
});

test("팝업은 끝났을 때 닫기만 한다 — onDone 을 안 넘기면 폼이 지도로 라우팅한다", () => {
  assert.ok(/<ProfileEditForm\s+onDone=\{onClose\}\s*\/>/.test(read(DIALOG)), "팝업이 onDone 을 안 넘긴다");
});

/**
 * 기본값은 예전 동작이어야 한다. `/profile` 페이지는 `onDone` 없이 이 폼을 쓰는데,
 * 기본값이 사라지면 저장한 뒤 그 페이지에 그대로 갇힌다.
 */
test("페이지로 들어온 경우는 지금까지처럼 지도로 돌아간다", () => {
  const form = read(FORM);
  assert.ok(form.includes("onDone ?? (() => router.replace(ROUTES.home))"), "폼의 기본 복귀 경로가 사라졌다");
  assert.equal(form.match(/router\.replace\(ROUTES\.home\)/g).length, 1, "복귀는 기본값 한 곳에서만 정해야 한다");
});

test("페이지는 그대로 남아 있다 — 북마크와 뒤로가기가 깨지지 않게", () => {
  assert.ok(fs.existsSync(path.resolve(__dirname, "..", "src/app/profile/page.tsx")), "/profile 페이지가 사라졌다");
  assert.ok(read("src/constants/routes.ts").includes('profile: "/profile"'), "profile 경로가 사라졌다");
});
