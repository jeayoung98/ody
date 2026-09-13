# 15 재생 가능 여부 — spec

상태 ⬜ · Jira **S15P21A405-40** · 목표일 미정 · 선행 관계: 이 수치가 나와야 Jira S15P21A405-57([S] 재생할 수 없는 곡은 그 사실을 안내받는다)을 결정할 수 있다

## 목적
곡별로 외부 서비스에서 재생 가능한지 판정하고 **매핑률을 실측**한다. 매핑률을 모르면 재생 불가 곡을 지도에 노출할지 결정할 수 없고, 그 결정이 지도 밀도 자체를 바꾼다.

## 규칙 6 과의 관계 (먼저 못박는다)
`data/AGENTS.md` 규칙 6(D15 개정): 음원 파일 재생·다운로드·스크래핑 금지, 재생은 공식 플레이어 임베드(YouTube IFrame Player)로만. `video_id` 없는 곡의 링크는 YouTube **검색** URL 만.
이 스펙은 그 규칙을 바꾸지 않는다.
- 우리가 저장하는 것은 **외부 서비스가 공식 API 로 제공하는 식별자와 URL** 뿐이다.
- 음원 파일을 내려받거나 저장하지 않는다. 미리듣기 파일을 우리 서버에 두지 않는다.
- `preview_url` 은 외부 서비스 API 응답에 있을 때만 그대로 보관하고, 없으면 null 이다. 우리가 만들어내지 않는다.
- 스크래핑하지 않는다. 공식 API 와 그 쿼터 안에서만 조회한다.

## 산출물
카탈로그에 컬럼 4개:

```
playable        bool           외부 서비스에서 확인된 재생 가능 여부
external_id     string|null    외부 서비스 트랙 ID
mapping_method  string         "isrc" | "exact" | "none"
preview_url     string|null    외부 API 가 제공한 경우에만
```

실측 리포트 `output/playability_sample.json`:
```json
{ "sample_n": 10000, "seed": 42, "service": "<서비스명>", "measured_at": "...",
  "rate_overall": 0.0, "rate_bridge": 0.0, "rate_korean": 0.0,
  "rate_by_genre": { "발라드": 0.0, "...": 0.0 },
  "by_method": { "isrc": 0, "exact": 0, "none": 0 },
  "quota": { "calls_used": 0, "daily_limit": 0 } }
```

## 매핑 규칙
1. **ISRC 우선** — MusicBrainz recording MBID → ISRC → 외부 서비스 조회. 가장 신뢰도 높다.
2. **완전일치 폴백** — ISRC 가 없으면 `(artist_norm, title_norm, length ±3s)` 세 조건 **전부** 일치할 때만. `work/v2_song_meta.parquet` 의 정규화 값을 쓴다.
3. **추측 금지** — 부분일치·유사도 매칭 금지. 한국 곡은 한글 완전일치만(규칙 8). 로마자 추측 매칭은 라벨 오염이다.
4. 불확실하면 `mapping_method="none"`, `playable=false`, `external_id=null`. **모르는 것을 재생 가능으로 만들지 않는다.**

## 수용 기준
- AC1 표본 10,000곡(브릿지 / 비브릿지 / 한국 곡 층화, seed 42)에 대해 `output/playability_sample.json` 이 위 스키마대로 생성되고, 전체·브릿지·한국곡·장르별 매핑률이 들어간다.
- AC2 매핑된 곡 중 `mapping_method="isrc"` 인 건은 ISRC 가 실제로 일치한다(표본 100건 수동 확인 기록 `output/playability_spotcheck.md`).
- AC3 `mapping_method="exact"` 인 건은 세 조건이 전부 만족된다. 자동 검사 `tests/test_playability.py::test_exact_match_strict` 가 위반 0을 확인한다.
- AC4 매핑률이 사전 등록 게이트 `gates/playability_gate_v1.json` 의 임계 미만이면, 재생 불가 곡을 지도에서 **제외하지 않고 표시만** 한다(규칙 2). 이 판정 결과를 `specs/DECISIONS.md` 에 새 번호로 기록한다.
- AC5 API 쿼터·약관 기록: 하루 호출 상한, 실제 사용량, 캐시 정책(재조회 주기)을 `docs/playability_api_notes.md` 에 적는다. 상한을 넘기는 실행을 하지 않는다.
- AC6 카탈로그 4개 컬럼에 null 규칙 위반이 없다(`playable=true` 인데 `external_id=null` 인 행 0).
- AC7 `pytest tests/test_playability.py` 통과.

## 비범위
- 음원 파일 재생·스트리밍·미리듣기 파일 저장(규칙 6). 공식 플레이어 임베드는 FE 담당.
- **전곡 매핑** — 6.6M 곡 × API 쿼터는 1차 기간에 불가능. 표본 실측이 이번 목표다. 전곡은 매핑률과 쿼터를 본 뒤 별도 결정.
- 외부 서비스 플레이리스트 내보내기(Jira S15P21A405-69, BE1 담당).
- 서비스 선택 자체 — 백엔드가 이미 Spotify OAuth 를 붙였으므로(Jira S15P21A405-41) 그쪽이 유력하지만, 최종 선택은 쿼터 확인 후 `docs/playability_api_notes.md` 에 근거와 함께 기록한다.
