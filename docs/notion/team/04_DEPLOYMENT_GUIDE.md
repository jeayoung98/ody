# Backend 배포 가이드

## 배포는 어떻게 되나요?

```text
Git master push
-> Jenkins 자동 시작
-> 테스트
-> Docker image 생성
-> app-node 전달
-> 비활성 Blue/Green 시작
-> health 확인
-> Nginx 전환
-> 기존 container 종료
```

## Blue와 Green

| 이름 | Container | 내부 host port |
|---|---|---|
| Blue | `backend-blue` | 127.0.0.1:8081 |
| Green | `backend-green` | 127.0.0.1:8082 |

두 port는 외부에서 접속하지 않습니다. Nginx가 둘 중 현재 활성인 하나로만 요청을 전달합니다.

예를 들어 Blue가 서비스 중이면 새 버전은 Green에서 시작합니다. Green health가 UP인 것을 확인한 뒤 Nginx를
Green으로 바꾸고 Blue를 종료합니다.

## 팀원이 확인할 것

Jenkins에서 다음 Stage가 모두 성공해야 합니다.

```text
Checkout -> Test -> Build Docker Image -> Transfer Image -> Deploy -> Verify
```

app-node:

```bash
docker ps
grep -n 'server 127.0.0.1' /etc/nginx/sites-available/backend
curl -fsS https://j15a405.p.ssafy.io/actuator/health
curl -fsS https://j15a405.p.ssafy.io/api/hello
curl -fsS https://j15a405.p.ssafy.io/actuator/health/dependencies
```

## 실패했다면

Jenkins에서 실패 Stage와 build number를 기록합니다. app-node에서 target container log와 Nginx active port를
확인합니다. `backend/deploy.sh`는 새 버전 health/Nginx 검증 실패 시 기존 port로 되돌리도록 구성돼 있습니다.

원인을 모른 채 같은 배포를 반복하거나 container를 전부 삭제하지 않습니다. 직전 정상 image로 수동 rollback은
인프라 담당자와 image tag를 확인한 뒤 수행합니다.

## Frontend 배포

Frontend는 별도 Jenkins job이 `npm ci`, lint, test, build를 수행한 뒤 정적 artifact를 app-node에 전달합니다.
`/var/www/ody/releases/<BUILD_NUMBER>`는 배포 후 수정하지 않고, `current` symlink만 원자적으로 바꿉니다.

Frontend rollback은 app-node에서 `sudo ./frontend/deploy.sh rollback`으로 직전 `previous` release를 다시
가리키게 합니다. 이 과정은 Backend Blue-Green container나 DB volume을 변경하지 않습니다.
