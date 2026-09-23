package com.ssafy.backend.realtime.dto.reaction;

/**
 * S→C REACTION — 누가 나에게 어떤 반응을 보냈는지 알린다. 받는 사람 개인 큐로만 간다.
 *
 * 보낸 사람의 닉네임·사진은 담지 않는다. 받는 쪽이 이미 들고 있는 주변 사람 목록에서 찾는다.
 *
 * @param fromEmail 보낸 사람
 * @param reactionKey 이모지 키
 * @param sentAt 서버가 보낸 시각(ISO-8601)
 */
public record ReactionPayload(String fromEmail, String reactionKey, String sentAt) {
}
