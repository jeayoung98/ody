package com.ssafy.backend.taste.analysis;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collection;

import org.springframework.stereotype.Component;

@Component
public class TasteSnapshotHasher {

    public String hash(Collection<Long> musicIds, String analysisVersion) {
        String canonical = musicIds.stream().sorted().map(String::valueOf)
                .collect(java.util.stream.Collectors.joining(","))
                + "\u0000" + analysisVersion;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 unavailable", error);
        }
    }
}
