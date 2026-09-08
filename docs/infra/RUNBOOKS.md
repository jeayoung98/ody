# Infrastructure Runbooks

이 문서는 현재 운영 환경의 반복 점검과 복구만 다룬다. 서버 최초 설치나 configuration apply 절차는
Repository에서 제거했다.

## 상태 확인

```bash
# master-node
sudo python3 scripts/verify.py --master

# app-node
sudo python3 scripts/verify.py --app
```

개별 확인은 `ops/verify`의 backend, database, monitoring, cluster, CI/CD 스크립트를 사용한다.

## Backend rollback

```bash
docker image inspect backend:<previous-build>
./deploy.sh backend:<previous-build>
sudo bash ops/verify/backend.sh
```

## Backup / restore drill

```bash
sudo bash ops/backup/postgres.sh
sudo bash ops/restore/postgres.sh <ody.dump> ody_restore_<name>
sudo bash ops/backup/neo4j.sh --offline
sudo bash ops/restore/neo4j.sh <neo4j.dump> ody-neo4j-restore-<name>
```

restore는 격리된 DB/volume만 생성한다. 운영 대상 overwrite, volume 삭제, `down -v`를 실행하지 않는다.

## Performance regression

```bash
sudo bash ops/performance/run.sh smoke
sudo bash ops/performance/run.sh baseline
sudo bash ops/performance/run.sh load
sudo bash ops/performance/run.sh zero-downtime backend:<tested-tag>
```

## Reboot

두 node를 동시에 reboot하지 않는다. 실행 중 Spark/YARN job이 없는지 확인하고 app-node를 먼저 재부팅한 뒤
Backend/DB/DN/NM을 검증한다. 그 다음 master-node를 재부팅해 NN/DN/SNN/RM/NM, Jenkins, Nginx,
Prometheus/Grafana/Exporter와 전체 cluster를 검증한다. 서비스의 실제 unit/config 변경은 서버 운영
절차로 별도 관리한다.
