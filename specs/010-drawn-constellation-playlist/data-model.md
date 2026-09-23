# Data Model: 직접 그린 별자리 기반 플레이리스트 생성

**스키마 변경 없음.** DDL·마이그레이션 없음. 새로 저장하는 것도 없다.

| 개념 | 표현 | 수명 |
| --- | --- | --- |
| 그린 별자리 | 요청 `points[]` — 3~20개 `{x, y}` (0~1, y 아래) | 요청 한 번 |
| 정규화 그림 | 서버 내부 `List<double[]>` — y 반전, 중심 이동, 최대 절댓값 1. `CatTemplate.points()` 와 같은 좌표계 | 요청 한 번 |
| 매칭 결과 | 응답 `{score, quality, points[{musicId, x, y}]}` | FE 화면 (저장 전까지) |
| 플레이리스트 | 기존 `playlist` + `playlist_item(position)` — `/playlist/create` 가 만든다 | 영구 |

## 규칙

- 곡 후보: `music` 중 `location IS NOT NULL AND NOT is_unplayable` (595 와 같음).
- 한 결과 안에 `musicId` 중복 없음. 점 i ↔ 곡 i.
- `quality` 는 `score` 에서만 나온다: ≥90 `HIGH`, ≥70 `MEDIUM`, 그 외 `LOW`.
- 별자리는 저장하지 않는다 — 플레이리스트 곡 순서에 `layout` 규칙(pc1/pc2 고정축)을 다시 적용하면 같은 좌표가 나온다.
