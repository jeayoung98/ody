# Quickstart: 002 조건 검색 검증

이 문서는 구현 후 실행할 검증 절차다. 현재 실행 성공 기록이 아니다.

## 사전 조건

- Java 17, 프로젝트 Gradle wrapper, 테스트용 PostgreSQL+pgvector 및 실행 가능한 BE.
- 실제 운영 데이터 변경 없이 전용 테스트 DB와 대표 데이터 복제 환경 사용.
- [계약](contracts/music-search.md) 기준 FE/BE 구현 완료.
- 기존 기준 커밋과 변경 커밋을 같은 데이터·인덱스·DB 설정으로 비교.
- DB 버전, 데이터 버전/행 수, 인덱스 정의/유효성, 서버 자원, 커밋, 동시 사용자 수 기록.

## 자동 검사

저장소 backend 디렉터리에서 PowerShell 실행:

~~~powershell
.\gradlew.bat test --tests 'com.ssafy.backend.music.MusicSearch*'
.\gradlew.bat test
.\gradlew.bat build
~~~

기존 controller/service/adapter 테스트에 다음 사례를 추가한다:
허용 조합 3개; 조건 없음·공백·혼합·music 단독·page 오류; query 경로 기존 mapper 사용;
size+1/offset/hasNext, NULL 재생 정보 및 좌표 보존.
기존 XML timeout/videoId 검사도 새 select를 대상으로 확장한다.

## 실제 SQL 검증

mock/H2만으로 PostgreSQL 정렬·인덱스 성능을 통과 처리하지 않는다.
전용 DB에 4개 관련성 단계 각각의 음악, 같은 제목·서로 다른 아티스트, NULL 아티스트,
대소문자 변형, %, _, 역슬래시, video_id='none'/NULL, 11건 이상 결과를 가진 fixture를 준비한다.
기존 MyBatis/JDBC로 실제 XML을 실행해 예상 ID 순서와 전체 페이지 합집합을 비교한다.
작은 fixture의 전체 정렬 참조 결과는 정답 검증 전용이며 서비스 SQL로 사용하지 않는다.
트랜잭션 롤백 또는 전용 DB 폐기로 격리한다. 운영 DB fixture 삽입 금지.

## API 확인

토큰은 환경변수로 전달하고 터미널 로그에 출력하지 않는다.

~~~powershell
curl.exe -sS -H "Authorization: Bearer $env:ODY_TEST_TOKEN" "$env:ODY_TEST_BASE_URL/api/music/search?query=Love&page=0"
curl.exe -sS -H "Authorization: Bearer $env:ODY_TEST_TOKEN" "$env:ODY_TEST_BASE_URL/api/music/search?artist=Radiohead&page=0"
curl.exe -sS -H "Authorization: Bearer $env:ODY_TEST_TOKEN" "$env:ODY_TEST_BASE_URL/api/music/search?music=Love&artist=Lana%20Del%20Rey&page=0"
~~~

기대: HTTP 200, content/size/page/hasNext, 제목/아티스트 조건 및 순서 일치.
결과 없음은 200 빈 배열, 잘못된 조합은 400 INVALID_INPUT.
연속 페이지에서 중복·누락 없음, 마지막 페이지 이후 빈 결과.
인증 없는 401은 현재 permitAll 때문에 미충족이다. Core 복구 후 별도로 검증한다.

## 실행계획과 성능 게이트

1. 실제 인덱스 정의 및 pg_index.indisvalid를 확인한다. 저장소 주석만으로 운영 인덱스 존재를 단정하지 않는다.
2. 먼저 EXPLAIN으로 각 경로와 흔함/희소/0건 조건의 예상 plan을 확인한다.
3. 격리 환경에서 제한 시간을 둔 EXPLAIN (ANALYZE, BUFFERS)로 실제 rows, removed rows, sort, buffer, 실행시간을 기록한다. ANALYZE는 실제 쿼리를 실행한다.
4. API warm-up 후 경로별 최소 1,000건을 측정한다. 1명과 5명 동시 사용자 부하를 각각 전후 동일하게 적용한다. 읽기 전용 검색만 수행한다.
5. 입력 집합: Love/Radiohead 및 실제 존재하는 희소 이름, 흔한 1~2글자 접두어, 0건 문자열, 두 조건 개별로는 많으나 교집합 0건, 리터럴 특수 문자. page=0/1/10/100 포함. cold/warm 측정은 구분한다.
6. 통합 p95는 이전의 1.10배 미만, 신규 두 경로 각각 p95 ≤ 300ms. 전체 평균으로 느린 경로를 숨기지 않고 시나리오별 분포도 남긴다. 오류/timeout 요청을 제외해 수치를 개선하지 않는다.
7. 실패하면 완료 처리하지 않고 plan/병목 기록 후 SQL 또는 인덱스 변경을 검토한다. 인덱스 추가 시 기존 통합 검색도 재측정한다.

관측은 기존 /actuator/prometheus의 http.server.requests 계열에서 요청률·지연 histogram·5xx를 비교한다.
DB 단일 실행시간은 API p95를 대신하지 않는다. 비교 중 데이터가 바뀌면 결과는 유효하지 않다.

## FE 인수와 완료

[frontend-handoff.md](frontend-handoff.md)의 세 경로, 칩 제거, 입력 대기, 오류/빈 결과, 페이지 초기화를 확인한다.
같은 검색 훅을 쓰는 JourneyComposer도 통합 검색이 정상인지 확인한다.
지도 포커스/고스트별/상세 패널이 기존대로 작동해야 한다.

완료 기록에는 자동 검사, SQL 정확성, 성능, FE 연동, 인증을 각각 통과/실패/미실행으로 표시한다.
성능 또는 인증 미검증을 전체 통과로 쓰지 않는다. 아직 문서만 작성한 단계에서는 위 검사를 실행하지 않는다.
