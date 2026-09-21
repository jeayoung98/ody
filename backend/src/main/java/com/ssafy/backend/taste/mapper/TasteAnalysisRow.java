package com.ssafy.backend.taste.mapper;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TasteAnalysisRow {
    private String email;
    private LocalDate analysisDate;
    private String status;
    private OffsetDateTime requestedAt;
    private OffsetDateTime leaseExpiresAt;
    private OffsetDateTime completedAt;
    private String likedSetHash;
    private int totalLikedCount;
    private int validMusicCount;
    private int excludedMusicCount;
    private String reportLevel;
    private String bundleVersion;
    private String referenceVersion;
    private String axisLabelVersion;
    private String analysisPolicyVersion;
    private String promptVersion;
    private String model;
    private String axisStats;
    private String findings;
    private String summary;
    private String narratives;
    private String gmsResponseId;
    private String failureCode;
}
