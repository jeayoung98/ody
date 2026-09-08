# Spark on YARN Operations

Spark 4.2.0 client는 master-node의 `/opt/spark`에 설치되어 있고 Java 17과 Hadoop 3.5.0을 사용한다.
Spark Standalone daemon은 사용하지 않는다. master에서 `spark-submit --master yarn`으로 제출하면
master/app NodeManager가 executor container를 실행한다.

Hadoop/Spark configuration과 systemd unit은 서버에 적용 및 reboot 검증 완료된 운영 상태다.
Repository는 해당 provisioning 원본을 보관하거나 재적용하지 않는다.

## Job 전후 검증

```bash
sudo -u ubuntu bash ops/verify/cluster.sh
spark-submit --master yarn <application> <arguments>
yarn application -list -all
```

- 전체 실행 전 작은 sample과 input schema를 검증한다.
- `collect()`/`toPandas()`로 대량 데이터를 driver에 모으지 않는다.
- input/output row count, schema, null/duplicate, partition 수를 기록한다.
- shuffle, spill, skew, executor failure와 driver memory를 확인한다.
- 실패 output을 정상 artifact로 publish하지 않는다.
- MapReduce staging replication은 2 DataNode에 맞게 운영 서버에 2로 적용되어 있다.

HDFS 장애 시 NameNode format이나 data directory 삭제를 복구 방법으로 사용하지 않는다.
