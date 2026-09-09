# Codex Infrastructure Workflows

이 문서는 Codex에 인프라 작업을 맡길 때 반복해서 사용할 작업 계약이다.

## 공통 규칙

Codex는 인프라 작업 시 다음 순서를 따른다.

```text
inspect
-> reproduce
-> change
-> validate
-> document
-> report
```

파일을 바로 만들기 전에 기존 저장소 구성을 먼저 확인한다.

## Deploy Workflow

목표:
현재 ODY backend를 안전하게 배포하고 상태를 검증한다.

필수 작업:
- 현재 상태 확인
- 변경 commit 확인
- build/test
- image build
- deploy
- health check
- 핵심 smoke test
- metrics 확인
- rollback 가능 상태 유지

결과 보고:
```text
deployed version
validation
metrics
risk
rollback version
```

## Observability Workflow

목표:
장애와 성능 병목을 확인할 수 있는 metric을 구축한다.

필수 작업:
- actuator 설정 확인
- Micrometer 확인
- Prometheus scrape 확인
- Grafana dashboard 확인
- high-cardinality label 검사
- 외부 노출 검사

## Incident Debug Workflow

목표:
증거 기반으로 원인을 좁힌다.

순서:
```text
impact
-> deployment
-> proxy
-> application
-> JVM
-> DB
-> host
```

원인이 불확실하면 확정적으로 표현하지 않는다.

## Performance Workflow

목표:
k6와 인프라 metric으로 성능 병목과 개선 효과를 검증한다.

필수:
- baseline
- test condition 기록
- k6
- JVM metric
- DB metric
- 변경
- 동일 조건 re-test
- 정량 비교

## Spark Workflow

목표:
대용량 처리 job을 안정적으로 검증하고 최적화한다.

순서:
```text
input/version 확인
-> sample run
-> schema/row validation
-> full run
-> Spark metrics
-> output validation
-> publish
```

전체 데이터 실행 전에 sample 검증을 생략하지 않는다.
