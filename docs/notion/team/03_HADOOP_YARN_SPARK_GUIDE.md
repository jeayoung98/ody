# Hadoop, YARN, Spark 이해하기

## 세 구성요소의 역할

- HDFS: 큰 파일을 여러 서버에 나누어 저장합니다.
- YARN: CPU와 memory를 작업에 배정합니다.
- Spark: YARN에서 실행되는 데이터 처리 프로그램입니다.

## ODY 구성

```text
                 master-node                   app-node
              +---------------+             +---------------+
HDFS          | NameNode      |             |               |
              | DataNode      |<----------->| DataNode      |
              +---------------+ replication +---------------+

YARN          | ResourceManager|            |               |
              | NodeManager   |<----------->| NodeManager   |
              +---------------+             +---------------+

Spark         | spark-submit  |             | Spark 설치 X  |
              +-------+-------+             +-------+-------+
                      |                             |
                      +---- YARN executor ----------+
```

## 가장 중요한 점

```text
Spark 설치 1대 != Spark 연산 1대
```

Spark 프로그램은 master-node에만 설치돼 있습니다. 하지만 ODY는 Spark Standalone이 아니라 Spark on YARN을
사용합니다. master-node가 작업을 제출하면 ResourceManager가 두 NodeManager의 자원을 보고 master/app 양쪽에
YARN container를 만들 수 있습니다. 그 container 안에서 Spark executor가 계산합니다.

app-node에 Spark 전체를 설치할 필요가 없습니다. Spark library는 제출 과정에서 HDFS의 `.sparkStaging`으로
전달될 수 있습니다.

## 현재 숫자

| 항목 | 값 |
|---|---|
| HDFS DataNode | 2대 |
| HDFS replication | 2 |
| YARN NodeManager | 2대 |
| NodeManager resource | 각 6144 MB, 3 vcores |
| Spark client | master-node 1대 |

## 기본 확인

```bash
jps
hdfs dfsadmin -report
hdfs fsck /
yarn node -list -all
```

정상 기준은 Live DataNode 2, FSCK HEALTHY, RUNNING NodeManager 2입니다.

## Spark job 전 확인

- HDFS와 YARN이 정상인가?
- 작은 샘플로 먼저 실행했는가?
- input/output schema와 row count를 기록하는가?
- partition과 executor memory 근거가 있는가?
- Backend 부하 테스트와 동시에 돌지 않는가?

실패한 Spark 결과는 정상 서비스 데이터로 사용하지 않습니다.
