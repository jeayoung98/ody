# Validation Results: 음악·아티스트 조건 검색

**Branch**: `backend/feat/S15P21A405-365-music-search-filter`
**Date**: 2026-09-17

## 변경 전 기준선

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 검색 자동 테스트 | 통과 | `backend/gradlew.bat test --tests 'com.ssafy.backend.music.MusicSearch*'`, BUILD SUCCESSFUL, 변경 전 실행 |
| 검증 DB 인덱스 | 미실행 | 이 작업 환경에 검증 DB 접속 정보가 없어 `pg_index.indisvalid`를 확인하지 못함 |
| API p95·오류율·timeout | 미실행 | 동일 데이터·부하의 실행 가능한 기준 서버가 없어 측정하지 못함 |

## 로컬 구현 검증

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 조건 조합 | 통과 | query 단독, artist 단독, music+artist 허용; 누락·공백·music 단독·혼합 거절 단위 테스트 |
| 통합 검색 회귀 | 통과 | 기존 `findPage`, size+1, long offset, hasNext, 응답 조립 테스트 |
| 아티스트 검색 | 통과 | 정규화·LIKE 리터럴 이스케이프·`findFilteredPage` 분기 테스트 |
| 음악+아티스트 검색 | 통과 | 두 조건 정규화·매퍼 인자·빈 결과 계약 테스트 |
| SQL 방어 조건 | 통과 | `findFilteredPage` timeout=2, artist 2단계/combined 4단계 `video_id IS DISTINCT FROM 'none'` 검사 |
| 인증 401 | 미충족 | `SecurityConfig`가 S15P21A405-243 임시 `anyRequest().permitAll()` 상태. Core 정책 복구 후 재검증 필요 |

### 대표 사례의 기대 결과

- `artist=Radiohead`: 아티스트 완전일치 뒤 앞일치 결과를 반환한다. NULL 아티스트와 `video_id='none'`인 행은 제외한다.
- `music=Love&artist=Lana Del Rey`: 두 조건 완전일치 → 아티스트 완전일치 → 음악 완전일치 → 모두 앞일치 순서로 반환한다.
- 각 조건에는 후보가 있지만 교집합이 없으면 200과 빈 `content`를 반환한다.
- 11건 이상이면 10건만 응답하고 `hasNext=true`로 표시하며 다음 페이지에서도 tier와 ID 순서를 유지한다.

## 전체 빌드 검증

| 명령 | 상태 | 근거 |
| --- | --- | --- |
| `.\gradlew.bat test --tests 'com.ssafy.backend.music.MusicSearch*' --no-daemon` | 통과 | 검색 관련 테스트 `BUILD SUCCESSFUL` |
| `.\gradlew.bat build --no-daemon --max-workers=1` | 통과 | test/check 포함 `BUILD SUCCESSFUL` |
| `.\gradlew.bat test --no-daemon --max-workers=1` | 통과 | 최종 `BUILD SUCCESSFUL`; 75 suites, 447 tests, 실패 0, 오류 0, skipped 35 |

전체 test 단독 실행 중 Gradle 결과 스트림 `EOFException`이 두 차례 발생했으나, 이후 같은 소스에서
`build`의 test/check와 최종 test 명령이 모두 성공했다. assertion 실패는 없었다.

## 실 DB·성능 게이트

- PostgreSQL+pgvector fixture 정확성: 미실행
- `EXPLAIN (ANALYZE, BUFFERS)`: 미실행
- 기존 통합 검색 p95 회귀 10% 미만: 미실행
- 아티스트 및 동시 검색 p95 300ms 이하: 미실행
- Frontend 연동: 별도 Frontend 이슈·브랜치 대기

실 DB·성능·인증·Frontend 항목을 모두 확인하기 전에는 기능 전체를 완료로 판정하지 않는다.
