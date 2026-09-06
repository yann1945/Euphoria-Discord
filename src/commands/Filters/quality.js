const {
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const emoji = require("../../emojis");

const QUALITY_PRESETS = {
    "Auto": { bitrate: "auto", opusQuality: 10, frameDuration: 20 },
    "Low": { bitrate: "64kbps", opusQuality: 5, frameDuration: 40 },
    "Medium": { bitrate: "96kbps", opusQuality: 7, frameDuration: 30 },
    "High": { bitrate: "128kbps", opusQuality: 10, frameDuration: 20 },
    "Ultra": { bitrate: "256kbps", opusQuality: 10, frameDuration: 10 },
};

module.exports = {
    name: "quality",
    aliases: ["audioquality", "aq"],
    category: "Filters",
    description: "Set audio quality and encoding settings",
    cooldown: 3,
    args: false,
    usage: "[preset name]",
    userPerms: [],
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    slashOptions: [
        {
            name: "preset",
            description: "Audio quality preset",
            type: 3,
            required: false,
            choices: [
                { name: "Auto", value: "auto" },
                { name: "Low", value: "low" },
                { name: "Medium", value: "medium" },
                { name: "High", value: "high" },
                { name: "Ultra", value: "ultra" },
            ]
        }
    ],

    async slashExecute(interaction, client) {
        const interactionWrapper = {
            guild: interaction.guild,
            channel: interaction.channel,
            author: interaction.user,
            member: interaction.member,
            createdTimestamp: interaction.createdTimestamp,
            reply: async (options) => {
                if (interaction.deferred) {
                    return await interaction.editReply(options);
                } else if (interaction.replied) {
                    return await interaction.followUp(options);
                } else {
                    return await interaction.reply(options);
                }
            },
        };

        const args = [];
        if (interaction.options) {
            const options = interaction.options.data;
            for (const option of options) {
                if (option.value !== undefined) {
                    args.push(option.value.toString());
                }
            }
        }

        const prefix = client.prefix;
        return this.execute(interactionWrapper, args, client, prefix);
    },

    async execute(message, args, client, prefix) {
        const player = client.manager.players.get(message.guild.id);

        if (!player.queue.current) {
            const warnDisplay = new TextDisplayBuilder()
                .setContent(`**${client.emoji.warn} There is no song currently playing.**`);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(warnDisplay);

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const currentPreset = player.data?.get("qualityPreset") || "Auto";
        const currentSettings = player.data?.get("qualitySettings") || QUALITY_PRESETS["Auto"];

        const presetMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("quality_preset")
                .setPlaceholder(`Current: ${currentPreset} (Click to change)`)
                .addOptions(
                    Object.keys(QUALITY_PRESETS).map((name) => ({
                        label: name,
                        value: name.toLowerCase(),
                        emoji: name === currentPreset ? client.emoji.check : client.emoji.dot,
                        default: name === currentPreset,
                    }))
                ),
        );

        const statusDisplay = new TextDisplayBuilder()
            .setContent(
                `**${client.emoji.info} Audio Quality Settings**\n` +
                `**Preset:** \`${currentPreset}\`\n` +
                `**Bitrate:** \`${currentSettings.bitrate}\`\n` +
                `**Opus Quality:** \`${currentSettings.opusQuality}/10\`\n` +
                `**Frame Duration:** \`${currentSettings.frameDuration}ms\``
            );

        const infoDisplay = new TextDisplayBuilder()
            .setContent(
                `**Quality Presets:**\n` +
                `\`Auto\` - Automatic quality based on network\n` +
                `\`Low\` - 64kbps, lower CPU usage\n` +
                `\`Medium\` - 96kbps, balanced\n` +
                `\`High\` - 128kbps, best quality\n` +
                `\`Ultra\` - 256kbps, maximum quality`
            );

        const separator1 = new SeparatorBuilder();
        const separator2 = new SeparatorBuilder();

        const container = new ContainerBuilder()
            .addTextDisplayComponents(statusDisplay)
            .addSeparatorComponents(separator1)
            .addTextDisplayComponents(infoDisplay)
            .addSeparatorComponents(separator2)
            .addActionRowComponents(presetMenu);

        const qualityMessage = await message.channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        const collector = qualityMessage.createMessageComponentCollector({
            filter: (i) => {
                if (message.author.id === i.user.id) return true;
                else {
                    const errorDisplay = new TextDisplayBuilder()
                        .setContent(`**${client.emoji.warn} That's not your session run. Use \`${prefix}quality\` to create your own.**`);

                    const errorContainer = new ContainerBuilder()
                        .addTextDisplayComponents(errorDisplay);

                    i.reply({
                        components: [errorContainer],
                        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
                    });
                    return false;
                }
            },
            time: 100000,
            idle: 30000,
        });

        collector.on("collect", async (i) => {
            if (!i.isStringSelectMenu()) return;

            const presetName = i.values[0].replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
            const settings = QUALITY_PRESETS[presetName];

            if (settings) {
                player.data?.set("qualityPreset", presetName);
                player.data?.set("qualitySettings", settings);

                const updatedDisplay = new TextDisplayBuilder()
                    .setContent(
                        `**${client.emoji.check} Quality preset set to: \`${presetName}\`**\n` +
                        `**Bitrate:** \`${settings.bitrate}\`\n` +
                        `**Opus Quality:** \`${settings.opusQuality}/10\`\n` +
                        `**Frame Duration:** \`${settings.frameDuration}ms\``
                    );

                const updatedMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("quality_preset")
                        .setPlaceholder(`Current: ${presetName} (Click to change)`)
                        .addOptions(
                            Object.keys(QUALITY_PRESETS).map((name) => ({
                                label: name,
                                value: name.toLowerCase(),
                                emoji: name === presetName ? client.emoji.check : client.emoji.dot,
                                default: name === presetName,
                            }))
                        ),
                );

                const updatedContainer = new ContainerBuilder()
                    .addTextDisplayComponents(updatedDisplay)
                    .addSeparatorComponents(separator1)
                    .addTextDisplayComponents(infoDisplay)
                    .addSeparatorComponents(separator2)
                    .addActionRowComponents(updatedMenu);

                await qualityMessage.edit({
                    components: [updatedContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            await i.deferUpdate();
        });

        collector.on("end", async () => {
            if (!qualityMessage.deleted) {
                await qualityMessage.delete().catch(() => { });
            }
        });
    }
};
