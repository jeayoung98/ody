# 서비스 상태 확인 명령

## app-node Backend

```bash
cd /home/ubuntu/S15P21A405
sudo bash ops/verify/backend.sh
docker ps
grep -n 'server 127.0.0.1' /etc/nginx/sites-available/backend
curl -fsS https://j15a405.p.ssafy.io/actuator/health
curl -fsS https://j15a405.p.ssafy.io/api/hello
curl -fsS https://j15a405.p.ssafy.io/actuator/health/dependencies
```

## master-node Jenkins

```bash
systemctl status jenkins --no-pager
curl -I http://127.0.0.1:8080/login
sudo nginx -t
```

Jenkins UI는 SSH tunnel 후 local browser에서 확인합니다.

```bash
ssh -L 8080:127.0.0.1:8080 ubuntu@j15a405a.p.ssafy.io
```

## Hadoop/YARN

```bash
cd /home/ubuntu/S15P21A405
sudo -u ubuntu bash ops/verify/cluster.sh
```

개별 명령:

```bash
jps
hdfs dfsadmin -report
hdfs fsck /
yarn node -list -all
```

## Spark

```bash
/opt/spark/bin/spark-submit --version
yarn application -list -appStates ALL
```

Spark job log는 해당 YARN application ID로 확인합니다.

```bash
yarn logs -applicationId <application-id>
```

## Monitoring

```bash
cd /home/ubuntu/S15P21A405
sudo bash ops/verify/monitoring.sh
```

master-node:

```bash
curl -f http://127.0.0.1:9090/-/ready
curl -f http://127.0.0.1:3000/api/health
```

정상 여부뿐 아니라 어느 서버에서 실행한 명령인지 함께 기록합니다.
