FROM eclipse-temurin:17-jdk-alpine AS builder

WORKDIR /app

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies

COPY src ./src
RUN ./gradlew --no-daemon clean bootJar

FROM eclipse-temurin:17-jre-alpine AS runtime

WORKDIR /app

# uid/gid 를 고정한다. 업로드 디렉터리를 호스트에서 마운트하는데, 소유자를 맞추려면 배포 스크립트가
# 컨테이너 사용자의 uid 를 알아야 한다 (backend/deploy.sh, S15P21A405-426).
RUN addgroup -S -g 10001 spring && adduser -S -u 10001 -G spring spring

COPY --from=builder --chown=spring:spring /app/build/libs/app.jar ./app.jar

USER spring:spring

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8080/actuator/health || exit 1

# realtime 프로파일을 배포 기본값으로 켠다 [S15P21A405-501].
# presence/nearby/viewport 빈 29개와 application-realtime.yml 이 이 프로파일에 묶여 있어서,
# 이게 없으면 /ws 는 열리지만 @MessageMapping 핸들러가 하나도 등록되지 않는다.
# 인증은 프로파일과 무관하다 — WebSocketAuthInterceptor 가 STOMP CONNECT 에서 항상 검사한다.
# 끄려면 배포 호스트 .env 에 SPRING_PROFILES_ACTIVE 를 넣어 덮어쓴다(--env-file 이 우선).
ENV SPRING_PROFILES_ACTIVE=realtime

ENTRYPOINT ["java", "-jar", "app.jar"]
