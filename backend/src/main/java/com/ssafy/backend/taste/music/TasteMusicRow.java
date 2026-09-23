package com.ssafy.backend.taste.music;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TasteMusicRow {
    private long musicId;
    private String title;
    private String artist;
    private Double pc1;
    private Double pc2;
    private Double pc3;
    private Double pc4;
    private Double pc5;
    private Double pc6;
    private Double pc7;
    private Double pc8;
    private Double pc9;
    private Double pc10;
    private Double pc11;
    private Double pc12;
    private Double pc13;
    private Double pc14;
    private Double pc15;
    private Double pc16;

    public double[] coordinates() {
        Double[] values = {
                pc1, pc2, pc3, pc4, pc5, pc6, pc7, pc8,
                pc9, pc10, pc11, pc12, pc13, pc14, pc15, pc16 };
        double[] result = new double[16];
        for (int i = 0; i < values.length; i++) {
            if (values[i] == null || !Double.isFinite(values[i])) {
                return null;
            }
            result[i] = values[i];
        }
        return result;
    }
}
