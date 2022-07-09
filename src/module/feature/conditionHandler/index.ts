import { CombatantPF2e } from "@module/encounter";
import { shouldIHandleThis } from "../../utils";
import { MODULENAME } from "../../xdy-pf2e-workbench";
import { ActorPF2e, CharacterPF2e } from "@actor";
import { getActor } from "../cr-scaler/Utilities";

//TODO Handle Eidolon/Animal Companion
export async function reduceFrightened(combatant: CombatantPF2e) {
    if (combatant && combatant.actor && shouldIHandleThis(combatant.isOwner ? game.user?.id : null)) {
        const actors = [combatant.actor];
        if (combatant.actor.type === "character" && (<CharacterPF2e>combatant.actor).familiar) {
            actors.push(<ActorPF2e>(<CharacterPF2e>combatant.actor).familiar);
        }
        for (const actor of actors) {
            const minimumFrightened = <number>actor?.getFlag(MODULENAME, "condition.frightened.min") ?? 0;
            const currentFrightened = actor?.getCondition("frightened")?.value ?? 0;
            if (currentFrightened - 1 >= minimumFrightened) {
                await actor.decreaseCondition("frightened");
            }
        }
    }
}

export async function increaseDyingOnZeroHP(
    actor: ActorPF2e,
    update: Record<string, string>,
    hp: number
): Promise<boolean> {
    if (
        shouldIHandleThis(actor.isOwner ? game.user?.id : null) &&
        // @ts-ignore
        hp > 0 &&
        getProperty(update, "data.attributes.hp.value") <= 0
    ) {
        const orcFerocity = actor.data.items.find((feat) => feat.slug === "orc-ferocity");
        const orcFerocityUsed: any = actor.data.items.find((effect) => effect.slug === "orc-ferocity-used");
        const incredibleFerocity = actor.data.items.find((feat) => feat.slug === "incredible-ferocity");
        const undyingFerocity = actor.data.items.find((feat) => feat.slug === "undying-ferocity");
        const rampagingFerocity = actor.data.items.find((feat) => feat.slug === "rampaging-ferocity");
        const deliberateDeath = actor.data.items.find((feat) => feat.slug === "deliberate-death");
        const deliberateDeathUsed: any = actor.data.items.find((effect) => effect.slug === "deliberate-death-used");

        if (orcFerocity && (!orcFerocityUsed || orcFerocityUsed.isExpired)) {
            setProperty(update, "data.attributes.hp.value", 1);
            if (undyingFerocity) {
                setProperty(update, "data.attributes.hp.temp", Math.max(actor.level, actor.hitPoints?.temp ?? 0));
            }
            await actor.increaseCondition("wounded");

            const effect: any = {
                type: "effect",
                name: game.i18n.localize(`${MODULENAME}.effects.orcFerocityUsed`),
                img: "systems/pf2e/icons/default-icons/alternatives/ancestries/orc.svg",
                data: {
                    slug: "orc-ferocity-used",
                    tokenIcon: {
                        show: false,
                    },
                    duration: {
                        value: incredibleFerocity ? 1 : 24,
                        unit: "hours",
                        sustained: false,
                        expiry: "turn-start",
                    },
                },
            };
            await actor.createEmbeddedDocuments("Item", [effect]);

            if (rampagingFerocity) {
                await ChatMessage.create({
                    flavor: game.i18n.format(
                        `${
                            actor.token?.name ?? actor.name
                        } has just used Orc Ferocity and can now use the free action: ${TextEditor.enrichHTML(
                            `@Compendium[pf2e.actionspf2e.FkfWKq9jhhPzKAbb]{Rampaging Ferocity}`
                        )}.`
                    ),
                    speaker: ChatMessage.getSpeaker({ actor: actor }),
                    whisper:
                        game.settings.get("pf2e", "metagame.secretDamage") && !actor?.hasPlayerOwner
                            ? ChatMessage.getWhisperRecipients("GM").map((u) => u.id)
                            : [],
                });
            }

            await actor.update(update);
            return false;
        }

        if (deliberateDeath && (!deliberateDeathUsed || deliberateDeathUsed.isExpired)) {
            const effect: any = {
                type: "effect",
                name: game.i18n.localize(`${MODULENAME}.effects.deliberateDeathUsed`),
                img: "icons/skills/melee/strike-dagger-skull-white.webp",
                data: {
                    slug: "deliberate-death-used",
                    tokenIcon: {
                        show: false,
                    },
                    duration: {
                        value: 24,
                        unit: "hours",
                        sustained: false,
                        expiry: "turn-start",
                    },
                },
            };
            await actor.createEmbeddedDocuments("Item", [effect]);

            await ChatMessage.create({
                flavor: game.i18n.format(
                    `${
                        actor.token?.name ?? actor.name
                    } can <b>before gaining Dying</b> as a result of another creature's attack or ability, if that creature is within melee reach, make a melee Strike against the triggering creature.<br>Remove 'Deliberate Death Used' effect if it actually can't be used.`
                ),
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                whisper:
                    game.settings.get("pf2e", "metagame.secretDamage") && !actor?.hasPlayerOwner
                        ? ChatMessage.getWhisperRecipients("GM").map((u) => u.id)
                        : [],
            });
        }

        let value = 1;
        const option = <string>game.settings.get(MODULENAME, "autoGainDyingAtZeroHP");
        if (option.endsWith("ForCharacters") ? ["character", "familiar"].includes(actor.data.type) : true) {
            if (option?.startsWith("addWoundedLevel")) {
                value = (actor.getCondition("wounded")?.value ?? 0) + 1;
            }
            for (let i = 0; i < Math.max(1, value); i++) {
                await actor.increaseCondition("dying");
            }
        }
    }
    return true;
}

export async function removeDyingOnZeroHP(
    actor: ActorPF2e,
    update: Record<string, string>,
    hp: number
): Promise<boolean> {
    if (
        shouldIHandleThis(actor.isOwner ? game.user?.id : null) &&
        hp <= 0 &&
        getProperty(update, "data.attributes.hp.value") > 0
    ) {
        const value = actor.getCondition("dying")?.value || 0;
        const option = <string>game.settings.get(MODULENAME, "autoRemoveDyingAtGreaterThanZeroHP");
        if (option.endsWith("ForCharacters") ? ["character", "familiar"].includes(actor.data.type) : true) {
            for (let i = 0; i < Math.max(1, value); i++) {
                await actor.decreaseCondition("dying");
            }
        }
    }
    return true;
}

export async function autoRemoveUnconsciousAtGreaterThanZeroHP(
    actor: ActorPF2e,
    update: Record<string, string>,
    hp: number
): Promise<void> {
    if (
        shouldIHandleThis(actor.isOwner ? game.user?.id : null) &&
        hp <= 0 &&
        getProperty(update, "data.attributes.hp.value") > 0 &&
        actor.hasCondition("unconscious")
    ) {
        await actor.toggleCondition("unconscious");
    }
}
