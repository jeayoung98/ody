# 14 축 라벨 — spec

상태 ⬜ · Jira **S15P21A405-38** · 목표일 미정(13 장르 이후) · 컷 후보

## 목적
사용자가 "이 축이 무슨 뜻인지" 읽을 수 있게 한다(Jira S15P21A405-52 [S] 각 단계의 축이 무슨 뜻인지 읽을 수 있다). PC 축은 수학적 방향일 뿐 이름이 없다. 일상어 라벨을 붙이는 순간 근거가 필요하고, **근거 없는 라벨은 사용자에게 틀린 설명을 하는 것**이므로 이 스펙의 기본값은 "라벨 없음" 이다.

## 범위 정정 (Jira 문구와 실제 아티팩트의 차이)
Jira 38 은 `map_layer` 라벨 컬럼 주입을 말한다. 실제 아티팩트의 트리는 **노드마다 local PCA-2** 로 쪼갠다(`split_axes.npz` 에 노드별 `axes(2,16)`). 즉 축이 노드마다 다르다. 4,096 리프 × 2축을 사람이 검수할 수 없다.

따라서 1차 범위는 **전역 PC1~PC4 네 축만**이다. 노드별 local 축 라벨은 ⛔ 보류(§비범위).

## 산출물
`serving/<version>/aux/axis_labels.json` — 계약 v1 의 **선택 파일**(검사기는 없어도 FAIL 하지 않고 WARN).

```json
{ "bundle": "v2.2-pca16-2026-09-XX",
  "axes": [
    { "axis": "pc1", "label": "차분함 ↔ 격렬함", "status": "labeled",
      "candidates": ["...", "...", "..."],
      "evidence": { "low_tags": [["ambient", 3.1], ...], "high_tags": [["metal", 2.8], ...],
                    "low_songs": ["<mbid>", ...], "high_songs": ["<mbid>", ...] },
      "review": { "reviewers": 3, "agreement": "3/3", "date": "..." } },
    { "axis": "pc4", "label": null, "status": "unlabeled", "reason": "검수 불일치 (1/3)" }
  ] }
```

`status` 는 `labeled` 또는 `unlabeled` 둘 뿐이다. 검수를 통과하지 못한 축은 라벨 없이 나가고, API 는 그 축에 대해 이름을 주지 않는다.

## 규칙
- 라벨은 **자동 검증이 불가능**하다. 그래서 게이트가 아니라 **검수 절차**로 관리한다(규칙 1 의 사전 등록 대상이 아님을 명시).
- 라벨 근거는 재현 가능해야 한다. 같은 번들·같은 seed 로 돌리면 같은 후보어가 나온다.
- 라벨 변경은 즉석에서 하지 않는다. `specs/DECISIONS.md` 에 새 번호로 기록한다(규칙 5).
- 근거 태그는 스펙 13 의 정규화된 태그를 쓴다. 스펙 13 이 끝나기 전에는 이 스펙을 시작하지 않는다.
- 라벨에 특정 아티스트·곡 이름을 넣지 않는다(오해 소지, 저작권 표기 문제).

## 수용 기준
- AC1 `scripts/axis_labels.py --bundle serving/<v>` 이 PC1~PC4 각각에 대해 후보어 3개와 근거(양극단 태그 log-odds 상위 10개, 대표곡 5곡씩)를 `output/axis_labels_<version>.json` 에 쓴다.
- AC2 같은 번들·같은 seed 로 두 번 실행하면 산출 JSON 이 바이트 단위로 동일하다(재현성).
- AC3 검수: 사람 3명이 축 4개마다 후보 3개 중 하나를 고르거나 "없음" 을 고른다. **다수결(2/3 이상)이 성립한 축**만 `status: "labeled"`. 4개 축 중 최소 3개가 labeled 여야 이 스펙을 완료로 본다. 미달이면 완료로 두지 않고 후보 생성 방법을 고친다.
- AC4 `unlabeled` 축은 `label: null` 로 나가고, API 응답과 FE 에 축 이름이 표시되지 않는다.
- AC5 `python tests/check_contract.py serving/<v>` 이 `aux/axis_labels.json` 이 있을 때도 없을 때도 FAIL 0.
- AC6 검수 기록(누가·언제·무엇을 골랐는지)이 `output/axis_label_review.csv` 에 남는다.
- AC7 `pytest tests/test_axis_labels.py` 통과 (스키마·status 규칙·unlabeled 시 label null).

## 비범위
- **노드별 local 축 라벨** — 4,096 리프 × 2축. 사람 검수 불가. ⛔ 보류.
- 자동 라벨 생성 모델(LLM 포함). 근거 없는 라벨을 만드는 것과 같다.
- PC5~PC16 라벨. 설명 분산이 낮아 사용자에게 보여줄 축이 아니다.
- 라벨 다국어 번역.
