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

ENTRYPOINT ["java", "-jar", "app.jar"]
