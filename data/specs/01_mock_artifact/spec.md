# 01 목업 서빙 아티팩트 — spec

상태 ⬜ · Jira **S15P21A405-32** · 목표일 09-10 · 계약 v1 (`00_artifact_contract`)

## 목적
E4 실데이터(트리 배치·카탈로그 확정)가 끝나기 전에 탐색 BE(효정)와 FE(주하)가 계약 기준으로 선행 개발할 수 있게, **계약 v1 과 완전히 같은 구조의 작은 번들**을 먼저 배포한다. 이 의존이 프로젝트 최대 병목이라 목업이 먼저 나가야 한다.

## 산출물
`serving/v0.0-mock/` — 계약 v1 필수 파일 10개 전부. 실번들과 파일 이름·스키마·dtype·manifest 키가 동일하고 행 수만 작다.

| 항목 | 목업 | 실번들(v2.1-pca16) |
|---|---|---|
| `manifest.songs` | 5,000 | 6,624,399 |
| `manifest.bundle_version` | `v0.0-mock-<YYYY-MM-DD>` | `v2.1-pca16-<날짜>` |
| `manifest.status` | `MOCK <날짜>` | `PROMOTED ...` |
| `coords_v2.parquet` | 5,000 × (mbid + pc1..pc16 float32) | 6,624,399 행 |
| `map_tree/tree.json` | 같은 id 규칙, 같은 max_depth 6 | 5,461 노드 |
| `model_bundle.npz` | 실번들 그대로 복사(25KB) | 동일 |
| 전체 크기 | ≤ 20MB (git 커밋 가능) | 0.7GB (git 제외) |

## 규칙
- 목업 mbid 는 **실번들 mbid 의 부분집합**. 가짜 UUID 를 만들지 않는다. FE 가 목업으로 만든 화면이 실데이터에서도 같은 곡을 가리킨다.
- 좌표·트리 파라미터는 실번들에서 그대로 가져온다. 새로 계산하지 않는다(규칙 3).
- 표본은 멜론 브릿지 곡에서 `qual_prepare.BUCKETS` 장르 버킷별 균등 추출 — 화면에 장르가 한쪽으로 쏠리지 않게.
- 목업도 `excluded`·`flag_*` 를 가진다. 제외 곡 미노출 동작을 FE 가 목업에서 확인할 수 있어야 한다(규칙 2·10).

## 수용 기준
- AC1 `python tests/check_contract.py serving/v0.0-mock` 이 FAIL 0 (WARN 허용).
- AC2 `serving/v0.0-mock/` 전체 ≤ 20MB 이고 git 에 커밋된다(`.gitignore` 의 parquet·npz 패턴에 이 디렉터리만 예외 등록).
- AC3 `serving/CURRENT.json` 을 `v0.0-mock` 과 `v2.1-pca16` 사이에서 바꿔도 번들을 읽는 코드(적재 잡·계약 검사) 변경 0. `tests/check_contract.py` 가 두 번들 모두에서 FAIL 0 으로 통과. (원래 문장은 `retrieval/` 서빙 코드 기준이었다. D12 로 그 코드가 없어졌다)
- AC4 목업 mbid 5,000개가 전부 실번들 `coords_v2.parquet` 의 mbid 집합에 포함된다.
- AC5 목업 트리가 **리프 200개 이상**을 채우고, `tree.json` 의 모든 내부 노드가 자식 4개를 유지한다(빈 자식은 `size: 0`).
- AC6 목업 `manifest.bundle_version` 이 `v0.0-mock-<날짜>` 다 — 적재된 행이 목업에서 온 것인지 실번들에서 온 것인지 구분할 수 있다. (원래 문장은 `GET /health` 기준이었다. D12 로 API 가 없어졌다)

## 비범위
- API 서버 일체. data 는 서빙 API 를 제공하지 않는다(D12).
- 가짜 오디오·앨범 이미지·미리듣기(규칙 6).
- 목업으로 성능 수치를 내는 것. 실측은 실번들 적재에서만(스펙 16·17·18).
