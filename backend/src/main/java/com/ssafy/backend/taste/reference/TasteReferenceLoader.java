package com.ssafy.backend.taste.reference;

import java.io.IOException;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class TasteReferenceLoader implements TasteReferenceProvider {

    private final ObjectMapper objectMapper;
    private final ResourceLoader resourceLoader;
    private final String resourceLocation;
    private final String expectedBundle;
    private volatile TasteReference reference;

    public TasteReferenceLoader(
            ResourceLoader resourceLoader,
            @Value("${ody.taste.reference-resource}") String resourceLocation,
            @Value("${ody.serving.bundle}") String expectedBundle) {
        this.objectMapper = new ObjectMapper().findAndRegisterModules();
        this.resourceLoader = resourceLoader;
        this.resourceLocation = resourceLocation;
        this.expectedBundle = expectedBundle;
    }

    @PostConstruct
    void load() {
        Resource resource = resourceLoader.getResource(resourceLocation);
        if (!resource.exists()) {
            log.warn("[Taste] 기준 산출물 없음 resource={}", resourceLocation);
            return;
        }
        try (var input = resource.getInputStream()) {
            TasteReference loaded = objectMapper.readValue(input, TasteReference.class);
            TasteReferenceValidator.validate(loaded, expectedBundle);
            reference = loaded;
            log.info("[Taste] 기준 산출물 로드 완료 referenceVersion={} bundleVersion={}",
                    loaded.referenceVersion(), loaded.bundleVersion());
        } catch (IOException | IllegalArgumentException error) {
            log.error("[Taste] 기준 산출물 검증 실패 resource={} error={}", resourceLocation, error.getMessage());
        }
    }

    @Override
    public Optional<TasteReference> current() {
        return Optional.ofNullable(reference);
    }
}
