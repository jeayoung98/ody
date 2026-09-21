package com.ssafy.backend.taste.analysis;

public record TasteFinding(
        String id,
        String type,
        Integer pc,
        String direction,
        double effectSize,
        String evidence,
        String axisPhrase) {
}
