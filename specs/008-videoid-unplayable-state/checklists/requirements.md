# Specification Quality Checklist: 재생 불가 판정을 백엔드가 직접 기록한다

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-18 | **Revised**: 2026-09-18 (프론트 의존성 발견 후 재작성)
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- **2026-09-18 3차 갱신 (MR 326 대조 + 삭제 결정 반영).** 판정 신호가 `is_unplayable` 이 아니라 최상위 `playable`·`retryable` 임을 코드로 확인했고, 재생 불가 행 삭제가 결정되면서 판정의 정본이 `music.is_unplayable` 칼럼으로 옮겨갔다. FR-001·FR-005 를 그에 맞게 고치고 FR-008(삭제된 곡 응답)을 추가했다.
- **FR-008 만 미해결이다.** 프론트 회신 대기이며 삭제 배치 가동 전에 정하면 된다. 나머지 요구사항의 검증을 막지 않는다.
- 유일하게 명세를 막을 수 있었던 D-Signal 은 해소됐다. 남은 의존(D-Backfill)은 우리가 실행할 선행 작업이다.

- **초안을 폐기하고 다시 썼다.** 처음에는 "표시값이 videoId 로 새어 나간다"를 버그로 잡았으나, 그 값이 **프론트가 의존하는 계약**임을 확인했다(S15P21A405-364, 2026-09-16). 초안대로 고쳤다면 재생 불가 안내가 "잠시 후 다시 눌러 주세요"로 퇴행하고 클릭마다 재조회가 나갔을 것이다. 경위는 [research.md](../research.md) §2 에 남겼다.
- **D-Signal 은 미확인이지만 명세를 막지 않는다.** FR-003 이 "가릴 수 없으면 기록하지 않는다"로 미확인 상태에서의 동작을 정의하기 때문이다. 필드가 확정되면 구현의 조건 한 줄만 채운다. 명세·수용 기준은 그대로 유효하다.
- FR-006(유사도 추측 판정 저장)은 품질이 아니라 **정책 선택**이다. 대가를 "알려진 한계"에 명시해 두었으므로 뒤집을 때 근거를 다시 만들 필요가 없다.
- 이 기능의 성공은 "아무것도 달라지지 않는 것"이다. 사용자에게 보이는 변화가 없어야 맞으며, 그래서 SC-001 을 "응답이 동일하다"로 잡았다.
