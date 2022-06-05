import { ChatMessagePF2e } from "@module/chat-message";

export function shouldIHandleThis(
    userId: string | undefined | null,
    playerCondition = true,
    gmCondition = true,
    extraCondition = true
) {
    const isUserActive = game.users?.players
        .filter((u) => u.active)
        .filter((u) => !u.isGM)
        .find((u) => u.id === userId);
    const rollAsPlayer = isUserActive && !game.user?.isGM && extraCondition && playerCondition;
    const rollAsGM = game.user?.isGM && extraCondition && !isUserActive && gmCondition;
    return rollAsPlayer || rollAsGM;
}

export function shouldIHandleThisMessage(message: ChatMessagePF2e, playerCondition: boolean, gmCondition: boolean) {
    const userId = message.data.user;
    const amIMessageSender = userId === game.user?.id;
    return shouldIHandleThis(userId, playerCondition, gmCondition, amIMessageSender);
}

export function nth(n) {
    return ["st", "nd", "rd"][((((n + 90) % 100) - 10) % 10) - 1] || "th";
}
