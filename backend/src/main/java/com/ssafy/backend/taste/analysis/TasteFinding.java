package com.ssafy.backend.taste.analysis;

import java.util.List;

public record TasteFinding(
        String id,
        String type,
        Integer pc,
        String direction,
        double effectSize,
        String evidence,
        String axisPhrase) {

    /** BOTH 축의 axisPhrase 를 잇는 구분자. 라벨에 나올 수 없는 형태라 되쪼갤 수 있다. */
    public static final String PHRASE_SEPARATOR = " / ";

    /**
     * 문장에 반드시 들어가야 하는 표현. 한쪽으로 기운 축은 그 한 마디, 넓게 퍼진 축은 양 극을 가르는 말이다.
     *
     * <p>2026-09-23 실호출로 두 번 고쳤다. 처음에는 BOTH 도 {@code "A부터 B"} 한 덩어리를 통째로
     * 요구했는데 그런 한국어 문장이 성립하지 않았다. 덩어리를 쪼갠 뒤에도, 양 극이 앞말을 공유하는 축
     * ({@code "박자가 촘촘한"} / {@code "박자가 성긴"})에서 자연스러운 문장은 그 앞말을 한 번만 쓴다
     * ("박자에는 촘촘한 것부터 성긴 것까지"). 그래서 공유하는 앞말을 떼고 <b>가르는 말만</b> 요구한다.
     *
     * <p>ponytail: 가르는 말만 보므로 축 이름이 문장에 없어도 통과한다. 근거가 약해지면
     * 축 이름을 따로 요구하는 쪽으로 좁힌다.
     */
    public List<String> requiredPhrases() {
        if (!axisPhrase.contains(PHRASE_SEPARATOR)) {
            return List.of(axisPhrase);
        }
        String[] poles = axisPhrase.split(java.util.regex.Pattern.quote(PHRASE_SEPARATOR));
        String[] low = poles[0].split(" ");
        String[] high = poles[1].split(" ");
        int shared = 0;
        while (shared < low.length - 1 && shared < high.length - 1 && low[shared].equals(high[shared])) {
            shared++;
        }
        return List.of(
                String.join(" ", java.util.Arrays.copyOfRange(low, shared, low.length)),
                String.join(" ", java.util.Arrays.copyOfRange(high, shared, high.length)));
    }
}
