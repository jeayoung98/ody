# Phase 0 Research: Music Taste Analysis

## Decision 1: 전체 카탈로그 기준 백분위를 사용한다

**Decision**: 사용자 좋아요 좌표에 PCA를 다시 수행하지 않고, 서빙 PCA의 각 축 값을 전체 카탈로그의 경험적 누적분포 백분위로 변환한다.

**Rationale**: 사용자별 PCA는 사람마다 축이 달라 비교와 축 해석이 깨지고, 표본 10~30개에서 매우 불안정하다. 원 PC 값만 평균내면 축별 범위와 분산 차이를 UI와 규칙이 직접 다뤄야 한다. 전체 모집단 백분위는 좌표계를 보존하면서 “전체 곡 중 어느 쪽인가”를 설명한다.

**Alternatives considered**:

- 사용자 좋아요에 PCA 재적용: 좌표 안정성과 축 라벨을 잃으므로 제외.
- PC별 z-score: 이상치와 비정규 분포에 민감해 경험적 백분위보다 설명력이 낮음.
- 원 PC 값만 제공: 기술적 진단에는 유용하므로 함께 보존하되 사용자 해석의 기준으로는 사용하지 않음.

## Decision 2: 중심과 폭을 함께 계산한다

**Decision**: 축별 median, Q1, Q3, IQR, min, max와 10-bin histogram을 계산한다. 평균 하나로 취향을 판정하지 않는다.

**Rationale**: 중앙값이 같은 분포도 좁은 단봉, 넓은 분포, 양봉일 수 있다. 중앙값과 IQR/histogram을 함께 사용해야 편향과 다양성을 구분하고 양 끝 분포를 “중간 선호”로 오해하지 않는다.

**Alternatives considered**:

- 평균/표준편차만 사용: outlier와 양봉 분포를 잘못 요약할 수 있음.
- KDE/군집 모델: 초기 기능과 10개 표본에 비해 복잡하고 파라미터 선택이 추가됨.

## Decision 3: 통계 판단과 자연어 생성을 분리한다

**Decision**: Backend가 버전 관리된 규칙으로 최대 3개 finding을 결정하고, LLM은 허용된 finding ID에 대한 한국어 summary/narrative만 반환한다.

**Rationale**: LLM에 좌표 전체를 주고 분석을 맡기면 축 의미·수치·장르를 꾸며낼 수 있다. 결정적 finding은 테스트와 재현이 가능하며 AI 장애 시 같은 근거로 fallback 문구를 만들 수 있다.

**Alternatives considered**:

- 모든 좌표를 LLM에 전달: 개인정보·비용·환각 위험 때문에 제외.
- 템플릿 문구만 사용: 안정적이지만 핵심 요구인 자연스러운 개인화 문장 생성 가치가 줄어 fallback으로만 사용.

## Decision 4: GMS는 Spring RestClient로 직접 호출한다

**Decision**: OpenAI 호환 GMS base URL에 `POST /responses`를 비스트리밍으로 호출한다. `store=false`와 strict JSON Schema 출력을 사용하며 API key와 model은 환경변수로 주입한다.

**Rationale**: 저장소에 이미 timeout을 설정한 `RestClient` 패턴과 로컬 HTTP server 테스트가 있다. 단일 endpoint와 작은 payload에 SDK나 LangChain을 추가할 이점이 없다. OpenAI Responses API는 `input`, `instructions`, `max_output_tokens`, `store`, structured `text.format`을 지원한다.

**References**:

- [SSAFY GMS Quickstart](https://gms.ssafy.io/web/guide/quickstart)
- [OpenAI Responses create API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)

**Alternatives considered**:

- OpenAI SDK: base URL 교체는 가능하지만 현재 한 endpoint에는 새 의존성과 DTO 계층이 불필요.
- LangChain: 체인·도구 호출·retrieval 요구가 없어 과도함.
- streaming: 최종 JSON 전체를 검증한 후 저장해야 하므로 이 내부 호출에는 부적합.

## Decision 5: PostgreSQL row로 일일 제한과 생성 상태를 함께 관리한다

**Decision**: `(email, analysis_date)` 행을 조건부 claim하고 `PENDING/SUCCESS/FAILED`와 lease를 관리한다. 외부 호출은 DB transaction 밖에서 수행한다.

**Rationale**: 성공 저장만 차감, 실패 재시도, 동시 요청 배제, 결과 이력이 같은 일관성 경계에 있다. Redis lock과 별도 quota 저장소를 더하면 이중 쓰기 복구가 필요하다.

**Alternatives considered**:

- Redis rate limit: 성공 DB 저장과 원자성을 맞추기 어렵고 현재 요구에는 불필요.
- 마지막 성공 timestamp만 검사: 동시 요청 둘이 모두 외부 호출을 시작할 수 있음.
- 긴 DB transaction에서 GMS 호출: connection/lock을 외부 지연 동안 점유하므로 제외.

## Decision 6: 기준 산출물을 버전 고정 JSON으로 배포한다

**Decision**: 데이터 파이프라인이 16축 quantile·설명분산·검증 라벨·계보를 JSON으로 만들고 Backend artifact에 포함한다. 앱 시작 시 schema와 현재 bundle 일치를 검증한다.

**Rationale**: 매 요청마다 660만 곡을 집계할 수 없고, 운영 DB 값 변화에 따라 같은 입력의 해석이 조용히 바뀌면 재현성이 깨진다. 기준 파일은 코드와 같이 배포·롤백할 수 있다.

**Alternatives considered**:

- 런타임 전체 테이블 percentile 계산: 비용이 크고 결과 버전이 불명확함.
- 코드에 cut point/라벨 하드코딩: 데이터팀 산출물의 계보와 독립 검증이 어려움.
- PC5~PC16 라벨 추정: 현재 검증 근거가 없으므로 narrative에서는 제외. 통계와 시각화는 모든 축에 제공.
