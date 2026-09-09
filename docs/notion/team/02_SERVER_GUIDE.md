# 서버 사용 가이드

## 어느 서버에 들어가야 하나요?

| 하려는 일 | 서버 |
|---|---|
| Backend/Nginx/container 확인 | app-node |
| Jenkins/Pipeline/webhook 확인 | master-node |
| HDFS 전체 상태 확인 | master-node 우선 |
| Spark job 제출 | master-node만 |
| DataNode/NodeManager local process 확인 | 해당 node |
| Prometheus/Grafana 확인 | 적용 후 master-node |

## SSH 기본 개념

서버 접속 key와 계정은 팀의 안전한 credential 전달 절차를 사용합니다. key 파일을 Git, Slack, Notion에
올리지 않습니다.

```bash
ssh ubuntu@<server-address>
hostname
pwd
```

접속 직후 `hostname`으로 올바른 서버인지 확인합니다.

## 기본 확인 명령

```bash
hostname
date
uptime
df -h
free -h
jps
docker ps
```

master-node에서는 Jenkins를 확인합니다.

```bash
systemctl status jenkins --no-pager
```

app-node에서는 Backend와 Nginx를 확인합니다.

```bash
cd /home/ubuntu/S15P21A405
sudo bash ops/verify/backend.sh
```

## 로그 위치

| 대상 | 확인 방법 |
|---|---|
| Backend | `docker logs --tail 200 backend-blue` 또는 `backend-green` |
| Nginx | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` |
| Jenkins | `journalctl -u jenkins`와 Jenkins Build Console |
| systemd Hadoop/YARN | `journalctl -u <unit>` (unit 적용 후) |
| Spark | YARN application/container logs |
| Monitoring | `sudo python3 scripts/verify.py --master` / `docker compose logs` |

## 하면 안 되는 작업

- NameNode format
- `/data/hadoop` 삭제
- Docker volume/container 무차별 삭제
- `docker system prune -a`
- 8080/8081/8082/3000/9090/9100 public 공개
- 운영 key/token/password 출력 또는 커밋
- 확인 없이 모든 Hadoop/YARN process 동시 재시작
- app-node에 Spark 별도 설치

문제가 생기면 먼저 상태와 로그를 남기고, 최근 배포/작업 시각과 함께 인프라 담당자에게 전달합니다.
