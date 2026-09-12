# 004. 무한 스크롤이 스크롤도 하기 전에 다음 페이지를 당겨 왔다

- 이슈: S15P21A405-267
- 날짜: 2026-09-12

## 증상

검색 결과에 무한 스크롤을 붙이고 첫 확인을 하는데, **스크롤을 한 번도 안 했는데 결과가 20건**이었다.
첫 페이지는 10건이어야 한다.

```js
const box = [...document.querySelectorAll("div")].find((d) => d.className.includes("46vh"));
({ items: box.querySelectorAll("button").length, scrollTop: box.scrollTop, scrollH: box.scrollHeight, clientH: box.clientHeight });
// → { items: 20, scrollTop: 0, scrollH: 1021, clientH: 351 }
```

`scrollTop: 0` — 목록은 맨 위에 그대로 있는데 2페이지가 이미 붙어 있었다.
검색 한 페이지가 **18~24초**짜리 백엔드 호출이라(BACKEND-NOTES B-23) 그냥 낭비다.

## 원인

`IntersectionObserver` 를 목록 바닥의 sentinel 에 걸었다.

```ts
const io = new IntersectionObserver((e) => e[0]?.isIntersecting && loadMore(), {
  root: box,
  rootMargin: `0px 0px 160px 0px`,
});
io.observe(sentinel);
```

**`observe()` 를 부르면 옵저버는 즉시 한 번 콜백을 준다.** 그 시점의 레이아웃 기준으로 판정하는데,
관찰을 거는 `useEffect` 가 도는 순간에는 결과 버튼들이 아직 배치되기 전이라 sentinel 이 사실상 목록 위쪽에
있다 — 그래서 "바닥에 닿았다"로 잡혔다.

`rootMargin` 바닥 160px 도 거들었다. 목록 높이가 `max-h-[46vh]` = 351px 이라 **목록의 45%가 미리 걸리는 셈**이었다.
20초짜리 호출을 미리 당기려고 넉넉히 준 값이 오히려 독이 됐다.

## 조치

옵저버를 버리고 **스크롤 위치 비교**로 바꿨다.

```ts
const checkBottom = useCallback(() => {
  const box = boxRef.current;
  if (!box || !hasMore || isLoadingMore) return;
  if (box.scrollTop + box.clientHeight >= box.scrollHeight - SEARCH_LOAD_MORE_MARGIN_PX) loadMore();
}, [hasMore, isLoadingMore]);
```

- `onScroll` 에 걸어 두면 **스크롤이 일어나야만** 판정한다. 마운트 시점에 저절로 불릴 일이 없다.
- 결과가 목록 높이를 못 채워 스크롤바가 안 생기는 경우를 위해, 목록이 바뀔 때마다 한 번 더 본다.
  이때는 `0 + 351 >= scrollHeight - 160` 이 성립해야 하므로 **짧은 목록에서만** 불린다 — 그게 맞는 동작이다.

우리 케이스에 대입하면 `0 + 351 >= 1021 − 160 = 861` → false. 저절로 안 불린다.

## 확인

| 단계 | 결과 수 | 요청 |
| --- | --- | --- |
| 검색 직후 (스크롤 안 함) | **10** | `page=0` 1회 |
| 바닥까지 스크롤 | 10 (+ `다음 10곡 불러오는 중...`) | `page=1` 발사 |
| 약 20초 뒤 | **20** | — |

콘솔 실호출 로그로 중복이 없음을 확인했다.

```
[ODY ✅ 연결됨] /api/music/search?q=radiohead&page=0  200 · 18,814ms
[ODY ✅ 연결됨] /api/music/search?q=radiohead&page=1  200 · 33,475ms
```

`hasNext: false` 인 검색어(`Polyethylene Part`, 2건)에서는 `결과 끝` 이 뜨고 추가 요청이 없었다.

## 배운 것

**`IntersectionObserver.observe()` 의 첫 콜백은 "지금 상태"가 아니라 "관찰을 건 순간의 상태"다.**
목록을 그리는 것과 같은 렌더에서 관찰을 걸면 아직 비어 있는 레이아웃으로 판정된다.

무한 스크롤에서 옵저버를 쓸 거면 **sentinel 이 실제 콘텐츠 아래에 배치된 뒤에** 걸어야 하고,
`rootMargin` 은 스크롤 컨테이너 높이에 비해 충분히 작아야 한다. 그게 번거로우면 이 건처럼
스크롤 위치 비교가 더 단순하고 예측 가능하다 — 특히 **한 번의 헛 요청이 20초짜리**일 때는.
