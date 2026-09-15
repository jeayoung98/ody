# 팀 공통 규칙·명세

파트를 가리지 않고 **팀 전체가 함께 보는 문서**만 여기 둔다.
특정 파트 안에서만 통하는 규칙(코드 컨벤션, 폴더 구조 등)은 그 파트 폴더에 둔다.

| 문서 | 내용 | 누가 고치나 |
| --- | --- | --- |
| [CONVENTIONS.md](CONVENTIONS.md) | Git 컨벤션 — 커밋 메시지, 브랜치 전략·네이밍, MR | 팀 합의 후 |
| [FEATURES.md](FEATURES.md) | **기능 명세 (Source of Truth).** 기능 ID의 기준 | 기획 담당 확인 후 항목별로 |
| [BACKEND-NOTES.md](BACKEND-NOTES.md) | ERD·API·소켓 등 프론트↔백 협의 항목 | 항목을 발견한 파트가 추가하고 상대에게 알림 |
| [PC-AXES.md](PC-AXES.md) | **지도 16차원이 실제로 무엇을 가르는지.** 겹·축 라벨의 기준 | AI 파이프라인이 PCA 를 다시 학습하면 |

문서를 고쳤으면 **반대편 파트에 알린다.** 절차는 [루트 CLAUDE.md §3](../../CLAUDE.md) 참고.

`docs/` 아래 다른 폴더:

- [`docs/infra/`](../infra/) — 인프라 문서 (인프라 파트 소유)
- [`docs/notion/`](../notion/) — 노션 동기화 문서
