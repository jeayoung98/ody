package com.ssafy.backend.taste.reference;

import java.time.OffsetDateTime;
import java.util.List;

public record TasteReference(
        String schemaVersion,
        String analysisVersion,
        long populationCount,
        OffsetDateTime generatedAt,
        Lineage lineage,
        List<Axis> axes) {

    public record Lineage(
            String sourceManifest,
            String sourceChecksum,
            String generatorCommit,
            String generatorConfig) {
    }

    public record Axis(
            int pc,
            double explainedVariance,
            List<Double> quantiles,
            Label label) {
    }

    /**
     * @param axis 축 이름 한 단어. 화면이 "#밝기 폭넓음" 처럼 태그를 만들 때 쓴다 [S15P21A405-634].
     *             {@code low}/{@code high} 가 양 끝 이름이라면 이것은 축 자체의 이름이다.
     */
    public record Label(
            String status,
            String strength,
            String axis,
            String low,
            String high,
            String evidence) {

        /**
         * 문장에 쓸 말이 있는가. <b>등급은 보지 않는다.</b>
         *
         * <p>등급(strength)은 축의 속성이고, 그 사용자가 이 축에서 튀는지는 분포가 정한다. 둘을 섞어
         * 등급으로 먼저 자르면, 어떤 사람이 약 등급 축에서 아무리 뚜렷하게 쏠려 있어도 후보에 들지 못한다.
         * 그래서 후보는 넓게 두고 순위는 effect size 가 정하게 한다 (2026-09-22 결정).
         *
         * <p>축끼리 비교가 공정한 이유는 통계가 백분위 위에서 재지고 임계값이 표본 크기별 잡음 분위수라
         * 축당 오탐률이 같기 때문이다. 원시 PC 값이었다면 분산이 큰 축이 늘 이긴다.
         *
         * <p>등급은 버리지 않는다. 응답의 {@code axes[].label.strength} 로 내려가고 어투 처리는 화면이 한다.
         */
        public boolean hasUsableWords() {
            return !"UNLABELED".equals(status)
                    && low != null && !low.isBlank()
                    && high != null && !high.isBlank();
        }
    }
}
