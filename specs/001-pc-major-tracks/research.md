# Phase 0 Research: PC 레벨·중심좌표 기반 대표곡 조회

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-09-08

이 문서는 spec에서 **확정된 정책을 다시 결정하지 않는다**. plan 단계에서 정할 수 있는 구현 설계(spec §2 D1~D6)만
결정하고, 제품/외부 계약 공백(spec §1 P1~P3 = plan B1~B6)에 의존하는 부분은 보류로 표시한다.

## 결정 요약

| ID | 결정 | 근거 | 기각한 대안 | 의존 보류 |
| --- | --- | --- | --- | --- |
| D1 | 조회는 "버전 고정 + 기존 탐색 제약 + 원형 내부" 전체 후보에 `youtubeCnt DESC`를 적용한 뒤 상위 k. 필터·정렬·limit을 같은 쿼리 의미 안에 둔다 | FR-013 (MUST NOT: 전역 top-k 선절단), 헌법 IX | (a) 전역 인기 top-k materialize 후 필터 — 후보 내부 상위곡 누락(FR-013 위반); (b) ANN 유사도 top-k — 인기 top-k를 보장하지 않음 | 물리 인덱스·DDL은 B6 (DB 미제공) |
| D2 | 내부를 4계층으로 분리: HTTP 바인딩(Controller) → 순수 조건 변환(Resolver) → 승인 정책 참조(Policy) → 조회 port(Reader). 오류는 기존 `GlobalExceptionHandler`로 변환 | 헌법 X(경계), 재사용 우선 | 단일 서비스 메서드에 전부 인라인 — 순수 로직 단위테스트 불가, BE4 경계 흐림 | 정책 값은 B1~B4, port 구현은 B6 |
| D3 | 요청 시 산정(on-request). 초기 설계에 공유 캐시 없음 | YAGNI, spec D3(결과 신선도 불변 요구) | 사전 산정/그리드 버킷 — 고정 그리드는 FR-012 MUST NOT; 캐시 — 키에 버전·정책·조회수 revision·모든 조건 필요, 조기 도입 시 정합성 위험 | 캐시 도입은 B4(조회수 갱신 일관성) 확정 후 |
| D4 | 한 요청 안에서 서빙 기준선 `v2.1-pca16` 1개, 정책 버전 1개, 조회수 snapshot 1개를 고정. 재학습·기준선 혼합 없음 | FR-007, 헌법 V·VII, team-roles §10 | 조회 중 실험 기준선 자동 적용 — 헌법 VII 위반 | 실제 아티팩트·스키마·계보 검증은 B6 |
| D5 | 테스트 2층: (1) Resolver·Policy 순수 단위테스트(DB 무관, 지금 작성 가능), (2) 기존 `@WebMvcTest` MVC 슬라이스 확장. 실데이터 통합은 B6 후 | 헌법 III, 기존 `MusicControllerTests` 재사용 | 즉시 full integration test — DB/아티팩트 없어 실행 불가 | 선정 기대값(정확한 ID·k·동률)은 B2~B4 |
| D6 | 기존 Actuator + Micrometer Prometheus 재사용. 요청 수·지연·오류·반환 수 지표 기록, 로그에 비밀/불필요 PII 제외 | FR-011, 헌법 VIII, `build.gradle` 확인 | 신규 관측 스택 도입 — 이미 존재, YAGNI | 이 API 단독 시간 예산·백분위·측정 환경은 미정(SC-003) |

## 상세

### D1 — 조회·정렬·정확성 계약

기준 의미는 **완전한 원형 판정 후 조회수 순 top-k**다. `MusicService.getMajor`의 기존 주석은 KNN/거리 산정을
언급하지만, 대표곡 선정 기준은 유사도가 아니라 `youtubeCnt` 내림차순(FR-013)이므로 유사도 top-k로 대체하지 않는다.

- **후보 A**: 버전 제한 `youtubeCnt` 순 인덱스 스캔에서 원/기존 조건을 적용하며 적격 k곡이 모일 때까지 진행.
  좁거나 비인기 영역·0곡이면 많은 행을 읽으므로 "인덱스=빠름"으로 단정하지 않는다.
- **후보 B**: 현재 축 원을 감싼 **사각 범위**로 후보를 줄이고, 정확한 원 판정 후 top-k 정렬. 사각형은 가속용
  상위집합이며 제품의 영역·고정 그리드가 아니다(FR-012). 두 축 range 복합 인덱스 효과는 DB별 실행계획으로 확인.
- **후보 C**: 기존 BE4 조회 서비스가 같은 정확성 계약(원형+제약+인기 top-k)을 제공하면 재사용.

대상 DB·물리 스키마가 없으므로(plan Storage=NEEDS CLARIFICATION) 최종 인덱스·DDL은 B6 이후 결정한다.
확인할 위험: 원형 조건 낮은 선택도, 조회수-좌표 상관, 정렬 spill, 메타데이터 조인 중복, 조회수 업데이트 비용,
잠정 k=1000의 PC16 전송량·직렬화·렌더링 비용. **약 662만 곡 전부를 JVM에 적재하지 않는다.**

### D2 — 모듈 경계

BE2(효정) 업무 로직 / BE4(재영) 조회 / BE1(준서) 공통 계층 경계(team-roles §5·§12·헌법 X)를 보존한다.
- Controller: HTTP 타입 해석·`ApiResponse` 조립만. 선정 로직 없음.
- `MajorQueryResolver`(제안): `level` n → 축 번호 `2n-1, 2n` 추출, 중심 결합. DB·HTTP 비의존 순수 함수.
- `MajorSelectionPolicy`(제안): 서버 레벨별 반경·k·경계 규칙 참조. **값 자체는 B2·B4 확정 후 주입**, 숨은 기본값 없음.
- `MajorTrackReader`(제안 port): BE4와 합의할 조회 인터페이스. 원형+누적 필터+top-k 계약을 표현.

새 검색엔진·ORM·캐시·보안 프레임워크를 신규 채택하지 않는다. 임시 공통 계층(`ApiResponse`/`GlobalExceptionHandler`,
"BE1 도입 시 교체" 주석)을 임의 삭제하지 않는다.

### D4 — 데이터 재현성 / 버전 고정

`Location`은 v2.1-pca16 기준 16차원 좌표(코드·api-spec §0.6 일치). 응답 PC 좌표는 저장된 고정값을 그대로 반환하며
조회가 좌표·모델을 바꾸지 않는다(FR-007, SC-002). 실제 아티팩트 접근·manifest·스키마·ID 매핑·조회수 계보는
이 체크아웃에서 확인 불가 → B6.

### master 통합 반영 (2026-09-09)

master 인프라 확인으로 일부 근거가 갱신됐다(상세는 [plan.md](plan.md) "master 통합 재검증" M1~M8):
- **D1(조회·인덱스)**: 저장소 = PostgreSQL + MyBatis mapper. 어댑터는 MyBatis mapper XML이 유력. ⚠️ **pgvector/벡터 확장은 master에 없음** →
  원형 조건의 물리 조회(스칼라 컬럼 범위 vs 벡터 인덱스)는 여전히 BE4 확인(B6). 후보 A/B/C 비교는 유효.
- **D3(캐시)**: master에 **redis** 존재. 캐시 도입 시 redis 사용 가능하나, 키에 버전·정책·조회수 revision·모든 조건 포함 원칙은 그대로(B4 전까지 미도입).
- **D6(관측)**: master `application.yml`이 `http.server.requests` 히스토그램을 이미 활성 → 지표 재사용, 근거 강화.
- **D4(버전 고정)**: 좌표 저장 형태·매니페스트는 여전히 미확인(B6). neo4j/postgres 중 좌표 저장소도 BE4 확인.

### 미해결(제품/외부 계약) — 설계로 덮지 않음

plan B1~B6 = spec P1~P3에 해당. research는 이들을 **결정하지 않는다**:
- B1(P1): 지원 레벨 상한, level 생략, 추가/누락 PC, 좌표 유효성.
- B2(P2): 레벨별 실제 반경 값·단위·축 스케일·원주 포함, level=1 PC 생략의 조회 대상.
- B3(P2): 장르·이전 PC 선택 조건과 현재 한 쌍 요청의 연결 계약.
- B4(P3): k 확정, 동률·null·중복·부족·빈 결과·페이지·조회수 갱신 일관성.
- B5(P3): Core 인증 연동, 토큰 없음 코드, `genres` 다형·null 표현 범위.
- B6(D-data): BE4 저장소·조회 인터페이스·스키마·접근 권한·데이터 분포.
