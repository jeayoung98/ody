# 15 재생 가능 여부 — plan

## 단계
`pipeline/playability_probe.py --sample 10000 --seed 42 --service <서비스> --gate gates/playability_gate_v1.json`

1. **표본 층화** — 브릿지 3,000 / 비브릿지 6,000 / 한국 곡 1,000. 한국 곡은 `is_korean` 기준(한글 완전일치로 만들어진 컬럼). 층별 비율을 리포트에 그대로 남긴다.
2. **ISRC 확보** — MusicBrainz canonical dump(2026-08-17, `data/canonical/`)에서 recording MBID → ISRC. 덤프에 없는 곡은 2단계로 내려간다. 여기까지는 API 호출이 0이다.
3. **외부 조회** — ISRC 로 트랙 조회. 배치 엔드포인트가 있으면 배치로(쿼터 절약). 응답에서 `id`, `is_playable`(시장 기준), `preview_url` 을 그대로 보관.
4. **완전일치 폴백** — `work/v2_song_meta.parquet` 의 `artist_norm`·`title_norm` + 카탈로그 `length` 로 검색해 세 조건 전부 일치하는 단일 결과만 채택. 결과가 2개 이상이면 `none`.
5. **캐시** — 모든 응답을 `work/playability_cache.parquet` 에 남긴다(mbid, 조회 시각, 원본 응답 요약). 재실행 시 캐시를 먼저 본다. 쿼터가 병목이라 재조회를 최소화한다.
6. **집계** — `output/playability_sample.json`.

## 게이트 (측정 전 등록)
`gates/playability_gate_v1.json`:
```json
{ "id": "playability_gate_v1", "registered": "<날짜>",
  "sample": { "n": 10000, "seed": 42, "strata": { "bridge": 3000, "nonbridge": 6000, "korean": 1000 } },
  "min_rate_overall": "<등록 시 확정>",
  "on_below": "재생 불가 곡을 제외하지 않고 표시만 한다 (규칙 2). 지도 밀도는 유지." ,
  "on_above": "재생 가능 여부를 서빙 필터 옵션으로 노출 (기본값은 여전히 미제외)" }
```
어느 쪽이든 **제외하지 않는다**. 게이트는 UI 정책을 가르는 것이지 곡을 지우는 기준이 아니다.

## 쿼터 산정
- 외부 API 의 하루 상한을 먼저 확인해 `docs/playability_api_notes.md` 에 적는다. 상한을 모른 채 대량 조회를 시작하지 않는다.
- 표본 10,000곡 기준 필요 호출 수를 배치 크기로 나눠 미리 계산하고, 상한을 넘으면 표본을 줄인다(정확도보다 약관 준수가 우선).
- YouTube Data API 는 D5 에서 이미 확인된 대로 하루 100곡 수준이라 이 용도로 쓰지 않는다.

## 리스크
- **국내 곡 매핑률이 낮을 것** — 멜론이 외부 서비스에 카탈로그를 주지 않는다. 한국 곡 층을 따로 세는 이유다. 낮게 나오면 "재생 불가 안내"(Jira 57)의 문구가 한국 곡에서 자주 뜬다는 뜻이고, 그건 제품 결정 사항으로 올린다.
- **시장(market)별 재생 가능 여부가 다르다** — `is_playable` 은 조회 시장 기준이다. 어느 시장으로 조회했는지 리포트에 명시한다.
- **약관** — 스크래핑 금지, 캐시 보관 기간 제한이 있을 수 있다. 확인 결과를 문서에 남기고 그 안에서만 동작한다.
- **표본이 전곡을 대표하지 않을 수 있다** — 브릿지 곡은 인기곡 쏠림이 있어 매핑률이 과대추정된다. 비브릿지 층 수치를 따로 보고한다.
