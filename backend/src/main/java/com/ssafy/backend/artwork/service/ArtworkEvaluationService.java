package com.ssafy.backend.artwork.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.ssafy.backend.artwork.dto.ArtworkPointRow;
import com.ssafy.backend.artwork.dto.ArtworkRoundRow;
import com.ssafy.backend.artwork.dto.ArtworkRow;
import com.ssafy.backend.artwork.evaluation.ArtworkEvaluation;
import com.ssafy.backend.artwork.evaluation.ArtworkEvaluationPort;
import com.ssafy.backend.artwork.mapper.ArtworkMapper;
import com.ssafy.backend.artwork.render.ArtworkRenderer;

import lombok.extern.slf4j.Slf4j;

/**
 * 작품 1건을 채점해 결과를 기록한다 (S15P21A405-563).
 *
 * <p>예외를 밖으로 내보내지 않는다 — 한 작품의 실패가 같은 배치의 나머지를 멈추면 안 된다.
 * 모든 실패 경로는 {@code FAILED} 기록으로 수렴한다.
 */
@Slf4j
@Service
public class ArtworkEvaluationService {

	private final ArtworkMapper artworkMapper;
	private final ArtworkRenderer renderer;
	private final ArtworkEvaluationPort evaluationPort;

	public ArtworkEvaluationService(
			ArtworkMapper artworkMapper, ArtworkRenderer renderer, ArtworkEvaluationPort evaluationPort) {
		this.artworkMapper = artworkMapper;
		this.renderer = renderer;
		this.evaluationPort = evaluationPort;
	}

	/**
	 * 채점하고 결과를 쓴다.
	 *
	 * <p>기록 쿼리는 {@code PENDING} 인 행만 바꾼다. 평가 도중 소유자가 작품을 지웠거나 재제출로
	 * 다른 행이 됐으면 0행이 되고 늦게 도착한 결과는 버려진다(spec Edge Cases).
	 */
	public void evaluate(ArtworkRow artwork) {
		long artworkId = artwork.getId();
		try {
			ArtworkRoundRow round = artworkMapper.findRoundById(artwork.getRoundId());
			if (round == null) {
				markFailed(artworkId, "회차 정보를 찾을 수 없음");
				return;
			}

			List<ArtworkPointRow> points = artworkMapper.findPoints(artworkId);
			if (points.isEmpty()) {
				markFailed(artworkId, "좌표가 없는 작품");
				return;
			}

			byte[] png = renderer.render(points);
			Optional<ArtworkEvaluation> evaluation = evaluationPort.evaluate(png, round.getThemePrompt());

			if (evaluation.isEmpty()) {
				markFailed(artworkId, "AI 채점 실패");
				return;
			}

			ArtworkEvaluation result = evaluation.get();
			int changed = artworkMapper.markScored(
					artworkId, result.score(), result.comment(), result.model());
			if (changed == 0) {
				log.info("[Artwork] 평가 결과를 버렸다 — 작품이 사라졌거나 상태가 바뀌었다 artworkId={}", artworkId);
				return;
			}
			log.info("[Artwork] 평가 완료 artworkId={} score={} model={}", artworkId, result.score(), result.model());
		} catch (RuntimeException e) {
			// 렌더 실패·DB 오류 등. 사유는 사람이 읽을 짧은 요약만 남긴다 — 응답 본문·키를 남기지 않는다.
			log.warn("[Artwork] 평가 중 오류 artworkId={} error={}", artworkId, e.toString());
			markFailed(artworkId, "평가 중 오류");
		}
	}

	private void markFailed(long artworkId, String reason) {
		artworkMapper.markFailed(artworkId, reason);
		log.warn("[Artwork] 평가 실패 artworkId={} reason={}", artworkId, reason);
	}
}
