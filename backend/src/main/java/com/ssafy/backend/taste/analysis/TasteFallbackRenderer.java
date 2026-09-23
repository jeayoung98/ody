package com.ssafy.backend.taste.analysis;

import java.util.List;

import org.springframework.stereotype.Component;

import com.ssafy.backend.taste.dto.TasteAnalysisResponse;

@Component
public class TasteFallbackRenderer {

    public RenderedReport render(String level, List<TasteFinding> findings) {
        String prefix = "INITIAL".equals(level) ? "현재 좋아요에서 보이는 잠정 경향으로, " : "";
        String summary = prefix + phrase(findings.get(0)) + " 음악을 즐기는 모습이 보여요.";
        List<TasteAnalysisResponse.Narrative> narratives = findings.stream()
                .map(finding -> new TasteAnalysisResponse.Narrative(
                        finding.id(), sentence(finding), finding.evidence()))
                .toList();
        return new RenderedReport(summary, narratives);
    }

    /** BOTH 축은 "A 곡부터 B" 로 편다. 한쪽으로 기운 축은 그대로 쓴다. */
    private static String phrase(TasteFinding finding) {
        List<String> phrases = finding.requiredPhrases();
        return phrases.size() == 2 ? phrases.get(0) + " 곡부터 " + phrases.get(1) : phrases.get(0);
    }

    private static String sentence(TasteFinding finding) {
        return switch (finding.type()) {
            case "CONSISTENT_BIAS" -> finding.axisPhrase() + " 쪽에 비교적 일관되게 모여 있어요.";
            case "BIAS" -> finding.axisPhrase() + " 쪽으로 기울어 있지만 취향의 폭도 함께 보여요.";
            case "DIVERSE" -> phrase(finding) + " 곡까지 폭넓게 듣는 편이에요.";
            default -> finding.axisPhrase() + "을 고르게 듣는 편이에요.";
        };
    }

    public record RenderedReport(
            String summary,
            List<TasteAnalysisResponse.Narrative> narratives) {
    }
}
