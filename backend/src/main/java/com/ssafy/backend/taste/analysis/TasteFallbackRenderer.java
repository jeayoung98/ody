package com.ssafy.backend.taste.analysis;

import java.util.List;

import org.springframework.stereotype.Component;

import com.ssafy.backend.taste.dto.TasteAnalysisResponse;

@Component
public class TasteFallbackRenderer {

    public RenderedReport render(String level, List<TasteFinding> findings) {
        String prefix = "INITIAL".equals(level) ? "현재 좋아요에서 보이는 잠정 경향으로, " : "";
        String summary = prefix + findings.get(0).axisPhrase() + " 음악을 즐기는 모습이 보여요.";
        List<TasteAnalysisResponse.Narrative> narratives = findings.stream()
                .map(finding -> new TasteAnalysisResponse.Narrative(
                        finding.id(), sentence(finding), finding.evidence()))
                .toList();
        return new RenderedReport(summary, narratives);
    }

    private static String sentence(TasteFinding finding) {
        return switch (finding.type()) {
            case "CONSISTENT_BIAS" -> finding.axisPhrase() + " 쪽에 비교적 일관되게 모여 있어요.";
            case "BIAS" -> finding.axisPhrase() + " 쪽으로 기울어 있지만 취향의 폭도 함께 보여요.";
            case "DIVERSE" -> finding.axisPhrase() + " 사이를 폭넓게 듣는 편이에요.";
            default -> finding.axisPhrase() + "을 고르게 듣는 편이에요.";
        };
    }

    public record RenderedReport(
            String summary,
            List<TasteAnalysisResponse.Narrative> narratives) {
    }
}
