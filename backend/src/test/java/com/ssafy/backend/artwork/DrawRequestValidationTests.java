package com.ssafy.backend.artwork;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import com.ssafy.backend.artwork.dto.DrawRequest;
import com.ssafy.backend.artwork.dto.DrawRequest.DrawPoint;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

/**
 * {@code POST /api/artwork/draw} 요청 검증 (S15P21A405-598). 위반은 {@code GlobalExceptionHandler} 가
 * {@code INVALID_INPUT} 400 으로 바꾼다 — 그 경로는 기존 테스트가 커버한다.
 */
class DrawRequestValidationTests {

	private static ValidatorFactory factory;
	private static Validator validator;

	@BeforeAll
	static void setUp() {
		factory = Validation.buildDefaultValidatorFactory();
		validator = factory.getValidator();
	}

	@AfterAll
	static void tearDown() {
		factory.close();
	}

	@Test
	void pointCount_3to20_isValid() {
		assertThat(validator.validate(new DrawRequest(points(3)))).isEmpty();
		assertThat(validator.validate(new DrawRequest(points(20)))).isEmpty();
	}

	@Test
	void pointCount_outOfRange_isViolation() {
		assertThat(validator.validate(new DrawRequest(points(2)))).isNotEmpty();
		assertThat(validator.validate(new DrawRequest(points(21)))).isNotEmpty();
		assertThat(validator.validate(new DrawRequest(null))).isNotEmpty();
	}

	@Test
	void coordinate_outside0to1_orMissing_isViolation() {
		List<DrawPoint> outside = new ArrayList<>(points(2));
		outside.add(new DrawPoint(1.5, 0.5));
		assertThat(validator.validate(new DrawRequest(outside))).isNotEmpty();

		List<DrawPoint> missing = new ArrayList<>(points(2));
		missing.add(new DrawPoint(0.5, null));
		assertThat(validator.validate(new DrawRequest(missing))).isNotEmpty();
	}

	private static List<DrawPoint> points(int n) {
		List<DrawPoint> out = new ArrayList<>();
		for (int i = 0; i < n; i++) {
			out.add(new DrawPoint(i / 20.0, (i % 2) * 0.5));
		}
		return out;
	}
}
