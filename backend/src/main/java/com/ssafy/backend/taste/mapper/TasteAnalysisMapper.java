package com.ssafy.backend.taste.mapper;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import org.apache.ibatis.annotations.Param;

public interface TasteAnalysisMapper {

    TasteAnalysisRow findLatestSuccess(@Param("email") String email);

    TasteAnalysisRow findByDate(@Param("email") String email, @Param("analysisDate") LocalDate analysisDate);

    TasteAnalysisRow findActivePending(
            @Param("email") String email,
            @Param("now") OffsetDateTime now);

    int expireStalePending(
            @Param("email") String email,
            @Param("requestedAt") OffsetDateTime requestedAt);

    int claim(
            @Param("email") String email,
            @Param("analysisDate") LocalDate analysisDate,
            @Param("requestedAt") OffsetDateTime requestedAt,
            @Param("leaseExpiresAt") OffsetDateTime leaseExpiresAt);

    int markSuccess(
            @Param("email") String email,
            @Param("analysisDate") LocalDate analysisDate,
            @Param("requestedAt") OffsetDateTime requestedAt,
            @Param("completedAt") OffsetDateTime completedAt,
            @Param("likedSetHash") String likedSetHash,
            @Param("totalLikedCount") int totalLikedCount,
            @Param("validMusicCount") int validMusicCount,
            @Param("excludedMusicCount") int excludedMusicCount,
            @Param("reportLevel") String reportLevel,
            @Param("bundleVersion") String bundleVersion,
            @Param("referenceVersion") String referenceVersion,
            @Param("axisLabelVersion") String axisLabelVersion,
            @Param("analysisPolicyVersion") String analysisPolicyVersion,
            @Param("promptVersion") String promptVersion,
            @Param("model") String model,
            @Param("axisStats") String axisStats,
            @Param("findings") String findings,
            @Param("summary") String summary,
            @Param("narratives") String narratives,
            @Param("gmsResponseId") String gmsResponseId);

    int markFailed(
            @Param("email") String email,
            @Param("analysisDate") LocalDate analysisDate,
            @Param("requestedAt") OffsetDateTime requestedAt,
            @Param("completedAt") OffsetDateTime completedAt,
            @Param("failureCode") String failureCode);
}
