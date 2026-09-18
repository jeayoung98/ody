package com.ssafy.backend.config;

import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 업로드된 프로필 이미지 정적 서빙 (S15P21A405-426).
 *
 * 배포 nginx 는 /api/ 만 백엔드로 프록시하므로, nginx 설정을 바꾸지 않고도 바로 열리도록 /api/ 하위에 둔다.
 * 나중에 인프라가 같은 디렉터리를 nginx 에서 직접 서빙하게 되면 PROFILE_IMAGE_BASE_URL 만 그 주소로 바꾸면
 * 되고 코드 변경은 없다 — 저장 URL 은 DB 에 절대 URL 로 들어간다.
 *
 * ProfileImageStorage 를 주입받지 않고 경로를 직접 읽는다 — WebMvcConfigurer 는 @WebMvcTest 슬라이스에도
 * 포함되기 때문에, 저장소 빈을 요구하면 모든 컨트롤러 슬라이스 테스트가 그 빈을 모킹해야 한다.
 *
 * 파일명이 UUID 라 같은 URL 의 내용이 바뀜지 않으므로 장기 캐시를 건다.
 */
@Configuration
public class ProfileImageWebConfig implements WebMvcConfigurer {

	public static final String URL_PATTERN = "/api/user/images/**";

	private final String location;

	public ProfileImageWebConfig(@Value("${ody.profile-image.dir}") String directory) {
		String uri = Path.of(directory).toAbsolutePath().normalize().toUri().toString();
		this.location = uri.endsWith("/") ? uri : uri + "/";
	}

	@Override
	public void addResourceHandlers(ResourceHandlerRegistry registry) {
		registry.addResourceHandler(URL_PATTERN)
				.addResourceLocations(location)
				.setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic());
	}
}
