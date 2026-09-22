/* eslint-disable @typescript-eslint/no-require-imports */
// 데모 봇이 사람처럼 보이는가 (S15P21A405-536).
// 눈으로 몇 분 지켜봐서는 "곡 길이가 다양한지" 를 판단할 수 없어 수치로 묶어 둔다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { nextEpisode, nextLayer, rnd } = require("../src/lib/bots/sim.ts");
const { BOTS } = require("../src/constants/bots.ts");
const { LAYER_COUNT } = require("../src/constants/map.ts");
const { BOT_ROSTER, isBot } = require("../src/lib/bots/roster.ts");

const T0 = 1_700_000_000_000;

/** 봇 하나를 n 번 돌린 에피소드들 */
function run(seed, n, preferredLayer = 0) {
  const out = [];
  let prev = null;
  let now = T0;
  for (let i = 0; i < n; i++) {
    prev = nextEpisode(seed, prev, now, preferredLayer);
    now = prev.endsAt;
    out.push(prev);
  }
  return out;
}

test("같은 입력이면 같은 결과다 — 테스트가 성립하는 전제", () => {
  assert.equal(rnd(7919, 3, 1), rnd(7919, 3, 1));
  assert.notEqual(rnd(7919, 3, 1), rnd(7919, 3, 2), "salt 가 다르면 다른 값이어야 한 에피소드에서 여러 번 뽑는다");
  assert.notEqual(rnd(7919, 3, 1), rnd(7919, 4, 1), "에피소드가 넘어가면 달라야 매번 같은 곡 길이가 안 나온다");
});

test("청취 길이가 곡마다 다르고, 정해 둔 범위를 넘지 않는다", () => {
  const listens = run(7919, 60).filter((e) => e.online).map((e) => e.endsAt - e.startedAt);
  assert.ok(listens.length > 30, "온라인이 절반 넘게 나와야 표본이 된다");
  for (const ms of listens) {
    assert.ok(ms >= BOTS.listenMs[0] && ms <= BOTS.listenMs[1], `청취 길이가 범위 밖이다: ${ms}`);
  }
  /**
   * **여기가 이 파일의 핵심이다.** 길이가 한 가지면 사람이 아니라 태엽으로 보인다.
   * 30초 폭 안에 다 몰려 있으면 실패로 본다 — 범위가 5분 반이라 그건 사실상 고정값이다.
   */
  assert.ok(Math.max(...listens) - Math.min(...listens) > 30_000, "청취 길이가 사실상 고정이다");
  assert.ok(new Set(listens).size > listens.length * 0.8, "같은 길이가 자꾸 반복된다");
});

test("자리를 비우는 일이 있고, 비운 다음에는 반드시 돌아온다", () => {
  const eps = run(7919, 120);
  const offline = eps.filter((e) => !e.online);
  assert.ok(offline.length > 0, "한 번도 자리를 안 비우면 봇 티가 난다");
  assert.ok(offline.length < eps.length * 0.5, "절반 넘게 비어 있으면 만날 수가 없다");

  for (const e of offline) {
    const ms = e.endsAt - e.startedAt;
    assert.ok(ms >= BOTS.offlineMs[0] && ms <= BOTS.offlineMs[1], `자리 비움 길이가 범위 밖이다: ${ms}`);
  }
  // 오프라인이 연달아 붙으면 한 번 사라진 봇이 십수 분 넘게 안 보인다 — 여섯 명뿐이라 화면이 빈다
  for (let i = 1; i < eps.length; i++) {
    assert.ok(eps[i].online || eps[i - 1].online, `${i}번째에서 오프라인이 연달아 붙었다`);
  }
});

test("곡은 시뮬레이터가 고르지 않는다 — 지도를 모르기 때문이다", () => {
  for (const e of run(7919, 20)) assert.equal(e.musicId, null, "곡은 부르는 쪽(use-bots)이 붙인다");
});

test("처음 등장하는 봇은 내가 보고 있는 겹에서 시작한다", () => {
  // 안 그러면 로그인 직후 화면이 여전히 비어 있다 — 봇을 만든 이유가 그것이다
  for (const bot of BOT_ROSTER) {
    assert.equal(nextEpisode(bot.seed, null, T0, 5).layer, 5);
  }
});

/** 봇 한 명을 `n` 에피소드 굴리며 겹만 따라간다 */
function layerWalk(seed, n, myLayer, startLayer) {
  let prev = { index: 0, online: true, layer: startLayer, musicId: null, startedAt: T0, endsAt: T0 };
  const out = [];
  for (let i = 1; i <= n; i++) {
    const next = nextLayer(prev, myLayer, (salt) => rnd(seed, i, salt));
    out.push(next);
    prev = { ...prev, index: i, layer: next };
  }
  return out;
}

test("겹은 늘 0..7 안에 있다 — 없는 겹에 서면 영영 안 보인다", () => {
  for (const bot of BOT_ROSTER) {
    for (const l of layerWalk(bot.seed, 60, 3, 6)) {
      assert.ok(Number.isInteger(l) && l >= 0 && l < LAYER_COUNT, `겹이 범위 밖이다: ${l}`);
    }
  }
});

test("딴 데 있던 봇은 내 겹으로 돌아온다 — 안 그러면 여덟 겹에 흩어져 못 만난다", () => {
  const MY = 3;
  let cameHome = 0;
  for (const bot of BOT_ROSTER) {
    // 세 에피소드 안에 돌아오는가. 한 에피소드가 길어야 7분이라 그 이상은 시연에서 못 기다린다
    if (layerWalk(bot.seed, 3, MY, 6).includes(MY)) cameHome++;
  }
  assert.ok(cameHome >= BOT_ROSTER.length - 1, `돌아온 봇이 ${cameHome}/${BOT_ROSTER.length} 뿐이다`);
});

test("내 겹에 있는 봇이 통째로 눌러앉지도, 우르르 떠나지도 않는다", () => {
  const MY = 3;
  let stayed = 0;
  let left = 0;
  // 여러 봇·여러 에피소드를 한데 모아 본다 — 한 봇의 한 구간만 보면 우연에 휘둘린다
  for (const bot of BOT_ROSTER) {
    for (const l of layerWalk(bot.seed, 80, MY, MY)) {
      if (l === MY) stayed++;
      else left++;
    }
  }
  assert.ok(left > 0, "한 번도 안 떠나면 '레이어 이동' 이 없는 것이다");
  assert.ok(stayed > left * 2, `너무 자주 떠난다 (머묾 ${stayed} / 떠남 ${left}) — 지도에서 사람이 깜빡거린다`);
});

test("봇 주소는 한 줄로 가려낼 수 있다 — 서버로 나가면 안 되는 요청을 막는 기준이다", () => {
  for (const bot of BOT_ROSTER) assert.ok(isBot(bot.email), bot.email);
  assert.ok(!isBot("jjy0843@gmail.com"));
  assert.ok(!isBot(null));
  assert.ok(!isBot(undefined));
  assert.equal(new Set(BOT_ROSTER.map((b) => b.email)).size, BOT_ROSTER.length, "이메일이 겹치면 목록에서 한 명이 사라진다");
  assert.equal(new Set(BOT_ROSTER.map((b) => b.seed)).size, BOT_ROSTER.length, "시드가 겹치면 두 봇이 똑같이 움직인다");
});

// ── 재생 불가 곡 넘기기 (S15P21A405-546) ──────────────────────────────────

test("안 틀리는 곡은 곡만 떼고 에피소드는 그대로 둔다", () => {
  const { dropSong } = require("../src/lib/bots/sim.ts");
  const bots = [
    { email: "a", episode: { index: 3, online: true, layer: 2, musicId: 100, startedAt: T0, endsAt: T0 + 200_000 } },
    { email: "b", episode: { index: 1, online: true, layer: 2, musicId: 200, startedAt: T0, endsAt: T0 + 300_000 } },
  ];
  const next = dropSong(bots, 100);

  assert.equal(next[0].episode.musicId, null, "그 곡을 들고 있던 봇만 곡이 빈다");
  assert.equal(next[1].episode.musicId, 200, "다른 봇은 건드리지 않는다");

  /**
   * **에피소드를 끝내면 안 된다.** 끝내면 `nextEpisode` 가 접속 여부를 다시 굴리고, 거기서
   * 오프라인이 나오면 그 봇을 따라가던 사람에게 "인솔자가 사라졌습니다" 가 뜬다 —
   * 곡 하나가 안 틀렸을 뿐인데 따라가기가 끊기는 셈이다.
   */
  assert.equal(next[0].episode.online, true, "접속 상태는 그대로");
  assert.equal(next[0].episode.layer, 2, "겹도 그대로");
  assert.equal(next[0].episode.endsAt, T0 + 200_000, "에피소드를 끝내지 않는다");
});

test("같은 곡을 여럿이 듣고 있으면 다 같이 넘긴다", () => {
  const { dropSong } = require("../src/lib/bots/sim.ts");
  const at = (email, musicId) => ({ email, episode: { index: 0, online: true, layer: 0, musicId, startedAt: T0, endsAt: T0 + 1 } });
  const next = dropSong([at("a", 7), at("b", 7), at("c", 9)], 7);
  assert.deepEqual(
    next.map((b) => b.episode.musicId),
    [null, null, 9],
  );
});

test("아무도 안 듣는 곡이면 그대로 돌려준다", () => {
  const { dropSong } = require("../src/lib/bots/sim.ts");
  const bots = [{ email: "a", episode: { index: 0, online: true, layer: 0, musicId: 1, startedAt: T0, endsAt: T0 + 1 } }];
  assert.deepEqual(dropSong(bots, 999), bots);
});

test("찾아서 넘긴 곡은 봇 상태에도 되쓴다 (S15P21A405-549)", () => {
  const { setSong } = require("../src/lib/bots/sim.ts");
  const ep = { index: 0, online: true, layer: 1, musicId: null, startedAt: T0, endsAt: T0 + 100 };
  const bots = [
    { email: "a", episode: ep },
    { email: "b", episode: { ...ep, musicId: 5 } },
  ];
  const next = setSong(bots, "a", 77);

  assert.equal(next[0].episode.musicId, 77, "되쓰지 않으면 다음 tick 이 또 다른 곡을 붙인다");
  assert.equal(next[1].episode.musicId, 5, "남의 곡은 안 건드린다");
  // 곡만 바꾼다 — 에피소드를 새로 굴리면 접속 여부까지 다시 정해진다
  assert.equal(next[0].episode.endsAt, ep.endsAt);
  assert.equal(next[0].episode.online, true);
});
