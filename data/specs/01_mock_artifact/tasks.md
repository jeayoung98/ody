# 01 목업 서빙 아티팩트 — tasks (Jira S15P21A405-32)

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | 표본 선정 (버킷별 균등 5,000) | `serving/v0.0-mock/sample_mbids.json` 5,000행, 버킷별 곡 수 편차 ≤ 2배 | ⬜ |
| T2 | `scripts/build_mock_bundle.py` — coords·node_paths·카탈로그 | `tests/test_mock_bundle.py::test_rows` (행 수 5,000, pc dtype float32) | ⬜ |
| T3 | tree.json·split_axes 서브셋 (자식 4개 유지) | `test_mock_tree_contract` (리프 ≥ 200, 내부 노드 자식 4개, 키 수 = 3 × 내부 노드) | ⬜ |
| T4 | manifest 재작성 + files 해시 | `python tests/check_contract.py serving/v0.0-mock` FAIL 0 (AC1) | ⬜ |
| T5 | 번들 교체 테스트 | `tests/test_mock_swap.py` 가 두 번들 모두에서 통과 (AC3) | ⬜ |
| T6 | `.gitignore` 예외 등록 + 커밋 | `git ls-files serving/v0.0-mock` 이 파일 전부 나열, 합계 ≤ 20MB (AC2) | ⬜ |
| T7 | BE·FE 배포 공지 (교체 절차·밀도 주의) | `docs/mock_artifact_notice.md` + Jira 32 코멘트 | ⬜ |
