# Hadoop/YARN/Spark 내부 구조

## 설치와 topology

| Component | master-node | app-node |
|---|---|---|
| Hadoop 3.5.0 `/opt/hadoop` | 설치 | 설치 |
| NameNode | 실행 | 미실행 |
| SecondaryNameNode | 실행 | 미실행 |
| DataNode | 실행 | 실행 |
| ResourceManager | 실행 | 미실행 |
| NodeManager | 실행 | 실행 |
| Spark 4.2.0 `/opt/spark` | client 설치 | 설치하지 않음 |

## HDFS

- `fs.defaultFS=hdfs://master-node:9000`
- replication 2
- NameNode: `/data/hadoop/hdfs/name`
- DataNode: `/data/hadoop/hdfs/data` on both nodes
- workers: master-node, app-node

NameNode metadata와 DataNode block은 Git에 저장되는 config와 별개의 운영 data다. 새 서버 복구 시 기존
namespace/data backup을 사용하며 format을 자동화하지 않는다.

## YARN

- ResourceManager: master-node
- NodeManager: 양쪽
- node resource: 6144 MB, 3 vcores
- scheduler min/max: 512/6144 MB
- local/log: `/data/hadoop/yarn/local`, `/data/hadoop/yarn/log`
- MapReduce framework: yarn

## Spark on YARN

master의 `spark-submit` client가 application을 ResourceManager에 제출한다. YARN은 executor용 container를
양쪽 NodeManager에 배치한다. app-node에는 Spark binary가 없어도 staging된 library로 executor가 실행된다.
Spark Standalone daemon을 추가하지 않는다.

`.sparkStaging`은 submit artifact 전달용 임시 HDFS 영역이다. 실패/stale application을 조사할 때 owner와
application state를 확인한 후에만 정리한다.

## MapReduce staging replication 장애 이력

1. 과거 staging file이 replication 10으로 생성됨
2. DataNode는 2대이므로 under-replicated 발생
3. stale staging job/file을 확인
4. 해당 stale data를 식별 후 정리
5. `mapreduce.client.submit.file.replication=2` 설정
6. FSCK에서 missing/corrupt/under-replicated가 0, HEALTHY 확인

재발 시 무조건 staging 전체를 삭제하지 않는다. `hdfs fsck <path> -files -blocks -locations`, file owner,
YARN application state를 연결해 실제 stale 여부를 확인한다.

## 관측/검증

```bash
jps
hdfs dfsadmin -report
hdfs fsck /
yarn node -list -all
yarn application -list -appStates ALL
```

Spark는 application duration, stage/task failure, executor memory, shuffle read/write, spill, skew,
input/output row count/schema를 기록한다.

## systemd 전환 위험

현재 수동 daemon이 실행 중인 상태에서 systemd unit을 start하면 중복 PID/port/data lock 문제가 생긴다.
unit 설치/enable 후 기존 시작 방식을 파악하고 유지보수 창에서 daemon 하나씩 전환한다. app worker부터
검증하고 master control daemon은 마지막에 다룬다.
