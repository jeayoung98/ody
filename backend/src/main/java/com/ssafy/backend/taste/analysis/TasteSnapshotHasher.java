package com.ssafy.backend.taste.analysis;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collection;

import org.springframework.stereotype.Component;

import com.ssafy.backend.taste.dto.TasteAnalysisResponse;

@Component
public class TasteSnapshotHasher {

    public String hash(
            Collection<Long> musicIds,
            TasteAnalysisResponse.ReferenceVersions versions,
            String promptVersion) {
        String canonical = musicIds.stream().sorted().map(String::valueOf)
                .collect(java.util.stream.Collectors.joining(","))
                + "\u0000" + versions.bundleVersion()
                + "\u0000" + versions.referenceVersion()
                + "\u0000" + versions.axisLabelVersion()
                + "\u0000" + versions.analysisPolicyVersion()
                + "\u0000" + promptVersion;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 unavailable", error);
        }
    }
}
