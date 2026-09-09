# Blue-Green Deployment 내부 구조

## Mapping

```text
Docker image app.jar -> container Spring :8080

backend-blue  : 127.0.0.1:8081 -> 8080
backend-green : 127.0.0.1:8082 -> 8080

Nginx upstream backend -> active host port
Client -> Nginx -> active container
```

8081/8082는 loopback bind이며 public에 열지 않는다.

## backend/deploy.sh 변수

| 변수 | 역할 |
|---|---|
| `IMAGE_NAME` | 첫 인자로 받은 immutable build image tag |
| `NGINX_CONFIG` | `/etc/nginx/sites-available/backend` |
| `BLUE_PORT/GREEN_PORT` | 8081/8082 |
| `BLUE_CONTAINER/GREEN_CONTAINER` | backend-blue/backend-green |
| `CURRENT_PORT` | Nginx upstream에서 grep으로 읽은 현재 port |
| `TARGET_PORT` | CURRENT의 반대 port |
| `CURRENT_CONTAINER` | 현재 traffic을 받는 container |
| `TARGET_CONTAINER` | 새 image로 시작할 container |

## 정상 순서

1. Nginx의 `server 127.0.0.1:<port>;` 첫 줄에서 CURRENT_PORT 탐지
2. 반대 TARGET_PORT/container 결정
3. 남은 target 이름 container 제거
4. 새 image를 `127.0.0.1:TARGET_PORT:8080`으로 실행
5. 최대 30회, 2초 간격 Actuator health status UP 확인
6. `sed`로 upstream port 한 줄 교체
7. `nginx -t`
8. Nginx reload
9. Nginx localhost를 통한 최종 health
10. 기존 container 제거

## Rollback path

- 새 container health 실패: target log 출력, target 제거, Nginx는 기존 port 유지
- `nginx -t` 실패: upstream을 기존 port로 되돌리고 target 제거, reload 없음
- 최종 Nginx health 실패: upstream 기존 port 복원, nginx test/reload, target 제거

기존 container는 최종 health 성공 뒤에만 제거한다.

## Nginx 원본과의 계약

Nginx template은 upstream에 정확한 형식 `server 127.0.0.1:8081;`을 유지한다. 이 형식을 바꾸면
`backend/deploy.sh`의 grep/sed 계약을 함께 검증해야 한다. live Nginx를 변경할 때는 active port와 rollback
가능한 이전 설정을 먼저 기록한다. Repository는 Nginx provisioning template을 더 이상 보관하지 않는다.

## 수동 진단

```bash
grep -n 'server 127.0.0.1' /etc/nginx/sites-available/backend
docker ps -a --filter name=backend-
curl -f http://127.0.0.1:8081/actuator/health
curl -f http://127.0.0.1:8082/actuator/health
sudo nginx -t
curl -f http://127.0.0.1/actuator/health
```

현재 active container/image를 기록하지 않고 수동 `sed`, container 강제 삭제, image prune을 하지 않는다.
