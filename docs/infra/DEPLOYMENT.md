# Backend Deployment

`backend/Jenkinsfile`, `backend/deploy.sh`, `backend/Dockerfile`이 Backend 배포 원본이다.

```text
Git push -> GitLab webhook -> Jenkins
-> Java 17 Gradle test -> backend:<BUILD_NUMBER> image
-> docker save/SSH/load -> app backend/deploy.sh
-> inactive Blue/Green slot + ody-internal + /etc/ody/backend.env
-> health/dependencies -> Nginx test/reload -> public HTTPS health
-> old slot remove
```

Blue는 `127.0.0.1:8081`, Green은 `127.0.0.1:8082`에 bind한다. `backend/deploy.sh`는 exclusive lock을
사용하고 image/network/env를 preflight한다. Nginx 전환이나 최종 health가 실패하면 이전 upstream을
복원한다.

수동 rollback은 app-node의 공식 checkout에서 존재하는 직전 immutable image tag를 확인한 뒤 실행한다.

```bash
docker image inspect backend:<previous-build>
./backend/deploy.sh backend:<previous-build>
sudo bash ops/verify/backend.sh
```

DB volume이나 서버 Nginx/TLS 파일은 애플리케이션 rollback 과정에서 변경하지 않는다. Nginx와 Certbot
구성은 서버에 적용 완료되어 있으며 Repository에서 재설치하지 않는다.

## Frontend static releases

Frontend는 Backend container와 분리해 `/var/www/ody`에 배포한다.

```text
/var/www/ody/
├── releases/<BUILD_NUMBER>/
├── current  -> releases/<ACTIVE_BUILD_NUMBER>
└── previous -> releases/<PREVIOUS_BUILD_NUMBER>
```

`frontend/deploy.sh deploy <artifact.tar.gz> <BUILD_NUMBER>`는 archive path와 marker를 검증하고 새 release를
완성한 뒤 `current` symlink를 `mv -T`로 원자 교체한다. `nginx -t`, Frontend root, 새 build marker,
`/api/hello`, 외부 Actuator 차단을 확인한다. 실패하면 기존 `current`/`previous` symlink를 복원한다.
최신 release 외에도 current, previous와 추가 과거 release를 보존한다.

app-node Nginx의 기존 TLS server block에는
`docs/infra/examples/frontend-nginx.locations.conf`를 기준으로 static location을 반영한다. 기존 `/api/` proxy,
`/actuator/` 접근 제어, upstream, Certbot block은 그대로 둔다. 변경 전후 `sudo nginx -t`를 통과한 경우에만
reload한다. 현재 Repository에서 live Nginx를 자동 덮어쓰지 않는다.

수동 rollback:

```bash
sudo ./frontend/deploy.sh status
sudo ./frontend/deploy.sh rollback
# 또는 검증된 release 지정
sudo ./frontend/deploy.sh rollback <BUILD_NUMBER>
```
