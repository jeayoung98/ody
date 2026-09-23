package com.ssafy.backend.taste.gms;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.ssafy.backend.taste.analysis.TasteFinding;

@Component
public class GmsTasteOutputValidator {

    private static final List<String> UNSUPPORTED_INFERENCES = List.of(
            "성격", "정신", "가사", "MBTI", "우울", "행복",
            "록 음악", "힙합", "재즈", "클래식", "발라드", "메탈", "인디", "EDM", "R&B");

    /**
     * axisPhrase 는 기울어진 방향을 이미 담고 있어서, 문장이 그것을 부정하면 뜻이 정반대가 된다.
     * 2026-09-23 실호출에서 {@code direction=LOW} 인 "어두운" finding 을
     * "어두운 음악에 덜 기울어져 있다" 로 뒤집어 쓴 출력이 나왔다.
     */
    private static final List<String> DIRECTION_REVERSALS =
            List.of("덜 ", "반대로", "아닌 ", "적게 ", "보다");

    public void validate(GmsTasteOutput output, List<TasteFinding> findings) {
        if (output == null || output.summary() == null || output.summary().isBlank()
                || output.summary().length() > 160 || output.narratives() == null
                || output.narratives().size() > 3) {
            throw new IllegalArgumentException("invalid GMS taste output");
        }
        Map<String, TasteFinding> allowed = findings.stream()
                .collect(Collectors.toMap(TasteFinding::id, Function.identity()));
        if (allowed.values().stream().noneMatch(finding -> usesPhrases(output.summary(), finding))
                || isUngrounded(output.summary())) {
            throw new IllegalArgumentException("GMS summary is not grounded in an allowed finding");
        }
        Set<String> seen = new HashSet<>();
        for (GmsTasteOutput.Narrative narrative : output.narratives()) {
            TasteFinding finding = narrative == null ? null : allowed.get(narrative.findingId());
            if (narrative == null || finding == null
                    || !seen.add(narrative.findingId()) || narrative.text() == null
                    || narrative.text().isBlank() || narrative.text().length() > 500
                    || !usesPhrases(narrative.text(), finding)
                    || isUngrounded(narrative.text())) {
                throw new IllegalArgumentException("GMS output contains an invalid finding");
            }
        }
        if (!seen.equals(allowed.keySet())) {
            throw new IllegalArgumentException("GMS output omitted an allowed finding");
        }
    }

    /** 넓게 퍼진 축은 양 극이 모두 나와야 하고, 한쪽으로 기운 축은 그 한 마디가 그대로 나와야 한다. */
    private static boolean usesPhrases(String text, TasteFinding finding) {
        return finding.requiredPhrases().stream().allMatch(text::contains);
    }

    /**
     * 근거 없는 추론, 방향을 뒤집는 표현, 그리고 문장에 섞여 나온 수치를 모두 거부한다.
     * 수치는 {@code evidence} 필드로 따로 내려가므로 문장에 있을 이유가 없다.
     */
    private static boolean isUngrounded(String text) {
        return UNSUPPORTED_INFERENCES.stream().anyMatch(text::contains)
                || DIRECTION_REVERSALS.stream().anyMatch(text::contains)
                || text.chars().anyMatch(Character::isDigit)
                || !isPoliteEnding(text);
    }

    /** 리포트 말투는 해요체로 고정한다. 끝의 문장부호를 떼고 마지막 글자가 '요' 여야 한다. */
    private static boolean isPoliteEnding(String text) {
        String trimmed = text.strip();
        while (!trimmed.isEmpty() && !Character.isLetterOrDigit(trimmed.charAt(trimmed.length() - 1))) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed.endsWith("요");
    }
}
