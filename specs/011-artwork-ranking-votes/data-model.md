# Data Model: 작품 순위·좋아요 3표

## DDL — `backend/src/main/resources/db/artwork_003_ranking_votes.sql` (운영 수동 적용, **배포 전에**)

```sql
ALTER TABLE public.artwork_round ADD COLUMN IF NOT EXISTS vote_limit int4    NOT NULL DEFAULT 3;
ALTER TABLE public.artwork_round ADD COLUMN IF NOT EXISTS ai_weight  numeric NOT NULL DEFAULT 5;
ALTER TABLE public.artwork       ADD COLUMN IF NOT EXISTS closed     boolean NOT NULL DEFAULT false;
```

- 기본값이 있어 기존 행·기존 코드가 그대로 동작한다 → DDL 먼저, 배포 나중.
- 롤백: 새 코드를 내린 뒤 `ALTER TABLE ... DROP COLUMN` 3개 (값 손실은 closed 뿐).
- 새 테이블·인덱스 없음.

## 규칙

| 개념 | 정의 |
| --- | --- |
| 순위 점수 | `like_cnt + score × ai_weight / 100` (조회 시 계산, 저장 안 함) |
| 순위 정렬 | 순위 점수 ↓, score ↓, created_at ↑ · 대상 `status = SCORED AND NOT is_anchor` |
| 쓴 표 | 그 회차 작품들(`artwork.round_id`)에 내가 준 `artwork_like` 수 |
| 남은 표 | `max(0, vote_limit − 쓴 표)` |
| 좋아요 가능 | 작품이 SCORED(또는 내 것 — 기존), 내 작품 아님, 작품 회차가 지금 열린 회차, 누를 때 쓴 표 < vote_limit |
| closed | 출품 요청값(없으면 false). 스냅샷 — 이후 바뀌지 않음 |

## 상태 변화

- 좋아요 누름: 쓴 표 +1 · `like_cnt` +1 · 순위 점수 +1
- 거둠 / 작품 삭제 / 재출품: 해당 좋아요 삭제 → 쓴 표 −1 (CASCADE 포함)
