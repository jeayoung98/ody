# 13 장르 계층 — spec

상태 ⬜ · Jira **S15P21A405-36** · 목표일 미정(검색 10~12 이후) · 1차 배포 여부는 §비범위

## 목적
곡에 장르를 붙여 지도 탐색(E6)·노드 요약(스펙 16 `map_layer`)·축 라벨(스펙 14)이 "여기는 무슨 지역인가" 를 말할 수 있게 한다. 분류 신뢰도가 낮은 곡은 제외가 아니라 **미분류로 격리**해 다음 배치에서 재처리한다.

## 데이터 현실 (여기서 출발한다)

| 출처 | 규모 | 한계 |
|---|---|---|
| 멜론 브릿지 `output/bridge_v2.parquet` | 67,536곡 (전체 6,624,399곡의 **1.0%**) | 장르 코드 `gnr` 보유. 유일한 정답 출처 |
| `work/genres_raw.parquet` | 23,203,978행 (mbid, offset, genre 리스트) | AcousticBrainz 제출본의 **자유 텍스트 태그**. 곡 단위 아님, 표기 흔들림, 비음악 태그 혼입 |
| `scripts/qual_prepare.GN` | 대분류 코드 21개 | **`genre_gn_all.json` 부재** — 멜론 소분류 코드→이름 전체 표가 없다 |

따라서 **대분류만 1차 범위**다. 소분류는 코드표를 확보하기 전까지 ⛔ 보류(§비범위).

## 산출물
카탈로그(`work/catalog_v2.parquet` → 다음 번들)에 컬럼 4개 추가:

```
genre_major       string        qual_prepare.BUCKETS 의 버킷 이름 중 하나 또는 "unknown"
genre_confidence  float32       0.0 ~ 1.0
genre_source      string        "melon" | "tag" | "none"
genre_tags_top3   list<string>  근거 태그 (왜 그렇게 분류됐는지 사람이 볼 수 있게)
```

스펙 16 의 `map_layer` 노드 요약이 이 컬럼을 쓴다(현재 구현 계획은 브릿지 곡만 쓴다). 노드 읽기 API 는 BE 담당이다(D12).

## 규칙
- **삭제 아님, 표시**(규칙 2). 미분류 곡을 카탈로그에서 빼지 않는다. `genre_major="unknown"` 으로 두고 `work/genre_unclassified.parquet` 에 목록만 따로 쓴다.
- 브릿지 곡의 멜론 장르는 **원본 그대로**. 태그 추정으로 덮어쓰지 않는다.
- 한국 곡 판정은 한글 완전일치만(규칙 8). 태그에 `k-pop` 이 있다고 한국 곡으로 만들지 않는다.
- 판정 임계값은 측정 전에 `gates/genre_gate_v1.json` 에 등록하고 사후 수정하지 않는다(규칙 1).
- 장르는 **표시용 컬럼**이다. 좌표·트리에 영향을 주지 않는다(규칙 3).

## 수용 기준
- AC1 카탈로그 전 행(7,404,506)에 위 4개 컬럼이 있고 null 이 없다(`genre_major` 는 최소 `"unknown"`).
- AC2 브릿지 67,536곡은 전부 `genre_source="melon"` 이고 `genre_major` 가 원본 `gnr` 첫 코드의 버킷과 100% 일치.
- AC3 **태그 분류 성능** — 브릿지 곡을 20% 홀드아웃(seed 42)해 태그만으로 예측했을 때 top-1 정확도 ≥ **0.60**. 이 수치를 측정 전에 `gates/genre_gate_v1.json` 에 등록한다. 미달이면 태그 분류를 서빙에 넣지 않고 해당 곡을 `genre_source="none"` 으로 남긴다.
- AC4 `genre_confidence` 가 게이트에 기록된 임계 미만인 곡은 `genre_major="unknown"` 이고 `work/genre_unclassified.parquet` 에 들어간다. 두 집합의 크기가 일치한다.
- AC5 노드별 `track_count`(장르 무관, 제외 곡 뺀 곡 수)에 대해 **자식 합 == 부모**, 리프 4,096 (스펙 16 AC3 과 같은 불변식).
- AC6 `genre_major` 분포 방향이 `docs/qual_check.md` 의 장르 × depth-1 자동 관찰 표와 맞다: 록/메탈(해외) root.2 최다, 재즈 root.1 최다, 랩/힙합(해외)·일렉트로니카 root.3 최다, 클래식·뉴에이지 root.0 최다.
- AC7 `pytest tests/test_genre.py` 통과.

## 비범위
- **소분류** — 멜론 소분류 코드표(`genre_gn_all.json`) 확보 전까지 ⛔ 보류. 확보되면 새 스펙 `13b`.
- 장르 이름 번역·다국어 표기.
- 사람 검수 라벨링(축 라벨 검수는 스펙 14).
- 1차 배포(09-14) 포함 여부는 `docs/plan_release1.md` 컷 순서를 따른다. 검색(10~12)과 트리 적재(16)가 먼저다.
