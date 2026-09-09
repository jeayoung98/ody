# 13 장르 계층 — plan

## 파이프라인
`pipeline/genre_assign.py --catalog work/catalog_v2.parquet --tags work/genres_raw.parquet --bridge output/bridge_v2.parquet --gate gates/genre_gate_v1.json`

1. **태그 정규화** — 소문자, 구두점·공백 정리, 동의어 표(`pipeline/genre_synonyms.json`, 예: `hip hop` / `hip-hop` / `hiphop` 를 하나로). 표는 손으로 만들고 커밋한다(재현성).
2. **곡 단위 집계** — `genres_raw` 는 제출본(offset) 단위라 mbid 로 묶어 태그별 제출본 수를 센다. 같은 곡의 제출본이 서로 다른 태그를 달 수 있다.
3. **태그 → 버킷 가중치 학습** — 브릿지 곡의 (태그, 멜론 버킷) 공기 빈도로 **log-odds** 를 낸다: `w(tag, bucket) = log( P(bucket|tag) / P(bucket) )`. 출현 곡 수 50 미만인 태그는 버린다(잡음). 결과 표 `output/genre_tag_weights.json` 을 커밋한다.
4. **예측** — 곡의 태그 가중치 합이 최대인 버킷을 고른다. `genre_confidence = 최대 버킷 점수 / 전체 버킷 점수 합`. softmax 를 쓰지 않는 이유는 값을 사람이 해석할 수 있어야 하기 때문이다.
5. **격리** — `confidence` 가 게이트의 `tau_genre` 미만이면 `unknown` + `work/genre_unclassified.parquet`.
6. **브릿지 우선** — 멜론 장르가 있으면 그것으로 덮어쓴다(`genre_source="melon"`, `confidence=1.0`).

## 게이트 (측정 전 등록)
`gates/genre_gate_v1.json`:
```json
{ "id": "genre_gate_v1", "registered": "<날짜>",
  "holdout": { "frac": 0.2, "seed": 42 },
  "min_top1_accuracy": 0.60,
  "tau_genre": "<등록 시 확정>",
  "min_tag_song_count": 50,
  "on_fail": "태그 분류를 서빙에 넣지 않고 genre_source=none 으로 둔다" }
```
기준이 틀렸다고 판단되면 새 id 로 재등록하고 원 판정을 보존한다(규칙 1).

## 알려진 오염 (감사에서 이미 확인된 것)
- 비음악 태그 12개 키워드 합집합 35,901곡(0.49%), 최대는 `comedy` 20,876 — 카바레 송 혼입 위험. `flag_comedy` 로 이미 표시돼 있다.
- `field recording`·`spoken word` 태그가 붙은 실제 음악이 S1 dry-run v2 표본에서 확인됐다. 태그를 제외 근거로 쓰지 않는다.

## 리스크
- **영어권 편향** — AcousticBrainz 제출자 분포상 국내 장르(발라드·댄스·랩/힙합 국내) 태그가 희박하다. HANDOVER 관찰에서도 국내 장르는 브릿지 표본이 100곡대라 판단 보류였다. 국내 장르 정확도를 따로 보고하고, 낮으면 국내 곡은 `melon` 출처만 신뢰한다.
- **버킷 정의가 멜론 기준** — 해외 곡을 한국 장르 체계에 억지로 넣는다. 대안은 AcousticBrainz highlevel 장르 모델이며 별도 결정 사항이다.
- **태그 없는 곡** — 태그가 하나도 없으면 `genre_source="none"`. 규모를 T3 에서 먼저 세고, 절반을 넘으면 이 스펙의 실효성을 재검토한다.
