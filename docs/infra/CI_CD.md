# Jenkins / GitLab CI/CD

## 현재 상태

CI/CD 플랫폼은 Jenkins로 확정됐고 실제 Pipeline과 GitLab webhook이 동작한다.

| 항목 | 값 |
|---|---|
| Jenkins node | master-node |
| Jenkins version | 2.568.2 |
| Jenkins runtime | Java 21 |
| Backend build | Java 17 `/usr/lib/jvm/java-17-openjdk-amd64` |
| SCM | GitLab HTTPS + Access Token credential |
| Branch | `master` |
| Webhook | `https://j15a405a.p.ssafy.io/project/backend-pipeline` |
| Deployment SSH | Jenkins 전용 key path `/var/lib/jenkins/.ssh/app_deploy` |

Credential 값과 private key 내용은 Repository에 저장하지 않는다.

## Pipeline

```text
Checkout
-> Test (Gradle Wrapper / Java 17)
-> Build Docker Image (backend:${BUILD_NUMBER})
-> Transfer Image (docker save | SSH | docker load)
-> Deploy (app-node backend/deploy.sh)
-> Verify (app Nginx /actuator/health)
-> master build image cleanup
```

`backend/Jenkinsfile`이 Source of Truth다. 저장소 반영 시 Jenkins Backend job의 Script Path를 기존
`Jenkinsfile`에서 `backend/Jenkinsfile`로 변경해야 하며, 현재 서버 변경은 아직 검증되지 않았다.
`disableConcurrentBuilds()`는 두 배포가 동시에 Blue/Green port를
전환하는 race를 방지한다. SSH는 `BatchMode=yes`, `StrictHostKeyChecking=yes`를 사용한다.

## Webhook 보안 경계

master Nginx는 HTTP를 HTTPS로 redirect한다. HTTPS에서는 exact path
`/project/backend-pipeline`의 POST만 Jenkins로 전달하고 나머지 경로는 404를 반환한다.
Jenkins `127.0.0.1:8080`은 인터넷에 직접 공개하지 않으며 UI는 SSH tunnel을 사용한다.

```bash
ssh -L 8080:127.0.0.1:8080 ubuntu@j15a405a.p.ssafy.io
```

## 사전 조건 검증

master-node에서 Jenkins 권한으로 실행한다.

```bash
cd /home/ubuntu/S15P21A405
sudo -u jenkins ./ops/verify/cicd.sh
```

검사는 Java 17, Jenkins active, Docker 접근, SSH key/known_hosts, app-node Docker와
`backend/deploy.sh`를 확인하며
상태를 변경하지 않는다.

## 배포 기록

Jenkins build history에서 최소 다음을 보존한다.

- Git commit
- `backend:${BUILD_NUMBER}` tag
- 시작/종료 시각과 결과
- 실패 Stage
- rollback 수행 여부와 대상 tag

## 변경 시 검증

Jenkinsfile을 바꾸면 Groovy 문법, 모든 shell block의 Bash 문법, 변수/quote, pipe failure propagation,
SSH target, `backend/deploy.sh` 인자, 최종 health 본문 검증, post cleanup 범위를 확인한다.

Webhook URL, credential ID 또는 secret을 Jenkinsfile에 새로 hard-code하지 않는다.

## Frontend Pipeline

Frontend는 기존 Backend job에 stage를 추가하지 않고 별도 `frontend/Jenkinsfile`과 Jenkins job을 사용한다.
Frontend 실패나 npm 변경이 Backend Blue-Green 배포를 막지 않게 하기 위한 경계다. 현재 Repository의 유일한
branch convention은 `master`이므로 Frontend job도 `master`만 checkout한다.

```text
Checkout
-> frontend 관련 변경 탐지
-> node:24.20.0-bookworm-slim
-> npm ci -> npm run lint -> npm test -> npm run build
-> dist + build-id.txt archive
-> SCP to app-node
-> frontend/deploy.sh atomic symlink switch
-> public /, build-id.txt, /api/hello, actuator 차단 검증
```

변경 탐지는 `GIT_PREVIOUS_SUCCESSFUL_COMMIT`과 현재 commit 사이에서 `frontend/`,
Nginx reference, Frontend zero-downtime scenario만 비교한다. 첫 build는 항상 실행한다. Jenkins에는 별도
Pipeline job을 만들고 Script Path를 `frontend/Jenkinsfile`로 지정한다. 기존 Backend webhook route를 수정하거나
재사용하지 말고, master Nginx에 별도의 exact POST webhook route를 추가한 뒤 두 job을 독립적으로 검증한다.

Frontend build에는 DB나 application secret이 필요하지 않다. Jenkins에 전달하는 `VITE_*` 값은 Browser에
공개 가능한 `/api` 같은 값만 허용한다.
