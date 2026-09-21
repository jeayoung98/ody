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

    public void validate(GmsTasteOutput output, List<TasteFinding> findings) {
        if (output == null || output.summary() == null || output.summary().isBlank()
                || output.summary().length() > 160 || output.narratives() == null
                || output.narratives().size() > 3) {
            throw new IllegalArgumentException("invalid GMS taste output");
        }
        Map<String, TasteFinding> allowed = findings.stream()
                .collect(Collectors.toMap(TasteFinding::id, Function.identity()));
        if (allowed.values().stream().noneMatch(finding -> output.summary().contains(finding.axisPhrase()))
                || containsUnsupportedInference(output.summary())) {
            throw new IllegalArgumentException("GMS summary is not grounded in an allowed finding");
        }
        Set<String> seen = new HashSet<>();
        for (GmsTasteOutput.Narrative narrative : output.narratives()) {
            TasteFinding finding = narrative == null ? null : allowed.get(narrative.findingId());
            if (narrative == null || finding == null
                    || !seen.add(narrative.findingId()) || narrative.text() == null
                    || narrative.text().isBlank() || narrative.text().length() > 500
                    || !narrative.text().contains(finding.axisPhrase())
                    || containsUnsupportedInference(narrative.text())) {
                throw new IllegalArgumentException("GMS output contains an invalid finding");
            }
        }
        if (!seen.equals(allowed.keySet())) {
            throw new IllegalArgumentException("GMS output omitted an allowed finding");
        }
    }

    private static boolean containsUnsupportedInference(String text) {
        return UNSUPPORTED_INFERENCES.stream().anyMatch(text::contains);
    }
}
