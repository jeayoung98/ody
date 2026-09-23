package com.ssafy.backend.taste;

import java.io.IOException;
import java.util.List;
import java.util.stream.IntStream;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.backend.taste.reference.TasteReference;

public final class TasteFixtures {

    private TasteFixtures() {
    }

    public static TasteReference reference() {
        try (var input = TasteFixtures.class.getResourceAsStream("/taste/taste-reference-fixture.json")) {
            if (input == null) {
                throw new IllegalStateException("taste reference fixture is missing");
            }
            return new ObjectMapper().findAndRegisterModules().readValue(input, TasteReference.class);
        } catch (IOException error) {
            throw new IllegalStateException("taste reference fixture is invalid", error);
        }
    }

    public static List<double[]> coordinates(int count) {
        return IntStream.range(0, count)
                .mapToObj(index -> {
                    double[] point = new double[16];
                    java.util.Arrays.fill(point, index);
                    return point;
                })
                .toList();
    }
}
