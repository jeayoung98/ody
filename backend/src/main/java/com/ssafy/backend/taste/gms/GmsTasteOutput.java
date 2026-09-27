package com.ssafy.backend.taste.gms;

import java.util.List;

public record GmsTasteOutput(String responseId, String summary, List<Narrative> narratives) {

    public record Narrative(String findingId, String text) {
    }
}
