const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const emoji = require("../../emojis");

const EQUALIZER_BANDS = [
    { band: 0, label: "25Hz" },
    { band: 1, label: "40Hz" },
    { band: 2, label: "63Hz" },
    { band: 3, label: "100Hz" },
    { band: 4, label: "160Hz" },
    { band: 5, label: "250Hz" },
    { band: 6, label: "400Hz" },
    { band: 7, label: "630Hz" },
    { band: 8, label: "1kHz" },
    { band: 9, label: "1.6kHz" },
    { band: 10, label: "2.5kHz" },
    { band: 11, label: "4kHz" },
    { band: 12, label: "6.3kHz" },
    { band: 13, label: "10kHz" },
    { band: 14, label: "16kHz" },
];

const PRESETS = {
    "Reset": [],
    "Bass Boost": [{ band: 0, gain: 0.3 }, { band: 1, gain: 0.25 }, { band: 2, gain: 0.2 }, { band: 3, gain: 0.1 }],
    "Deep Bass": [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.5 }, { band: 2, gain: 0.4 }, { band: 3, gain: 0.3 }, { band: 4, gain: 0.2 }],
    "Treble Boost": [{ band: 10, gain: 0.3 }, { band: 11, gain: 0.35 }, { band: 12, gain: 0.4 }, { band: 13, gain: 0.45 }],
    "Classical": [{ band: 0, gain: 0.1 }, { band: 1, gain: 0.15 }, { band: 2, gain: 0.1 }, { band: 3, gain: 0.05 }, { band: 10, gain: 0.1 }, { band: 11, gain: 0.15 }, { band: 12, gain: 0.1 }],
    "Electronic": [{ band: 0, gain: 0.5 }, { band: 1, gain: 0.4 }, { band: 2, gain: 0.3 }, { band: 3, gain: 0.2 }, { band: 10, gain: 0.3 }, { band: 11, gain: 0.4 }, { band: 12, gain: 0.5 }],
    "Hip Hop": [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.5 }, { band: 2, gain: 0.4 }, { band: 3, gain: 0.3 }, { band: 4, gain: 0.2 }, { band: 11, gain: 0.2 }, { band: 12, gain: 0.3 }],
    "Rock": [{ band: 0, gain: 0.4 }, { band: 1, gain: 0.3 }, { band: 2, gain: 0.2 }, { band: 10, gain: 0.3 }, { band: 11, gain: 0.4 }, { band: 12, gain: 0.5 }],
    "Jazz": [{ band: 2, gain: 0.2 }, { band: 3, gain: 0.3 }, { band: 4, gain: 0.4 }, { band: 5, gain: 0.3 }, { band: 6, gain: 0.2 }],
    "Pop": [{ band: 0, gain: 0.1 }, { band: 1, gain: 0.2 }, { band: 2, gain: 0.3 }, { band: 10, gain: 0.2 }, { band: 11, gain: 0.3 }, { band: 12, gain: 0.2 }],
};

function formatGain(gain) {
    return (gain >= 0 ? "+" : "") + gain.toFixed(2);
}

function buildEqualizerDisplay(gains) {
    const lines = EQUALIZER_BANDS.map(({ band, label }) => {
        const gain = gains[band] || 0;
        const bars = Math.round((gain + 0.25) / 0.75 * 10);
        const bar = "█".repeat(Math.max(0, bars)) + "░".repeat(10 - Math.max(0, bars));
        return `\`${label.padEnd(6)}\` \`${bar}\` \`${formatGain(gain)}\``;
    });
    return lines.join("\n");
}

module.exports = {
    name: "equalizer",
    aliases: ["eq"],
    category: "Filters",
    description: "Adjust audio equalizer bands",
    cooldown: 3,
    args: false,
    usage: "",
    userPerms: [],
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    slashOptions: [],

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

        const currentGains = {};
        EQUALIZER_BANDS.forEach(({ band }) => {
            currentGains[band] = 0;
        });

        const presetOptions = Object.keys(PRESETS).map((name) => ({
            label: name,
            value: name.toLowerCase().replace(/\s+/g, "_"),
            emoji: name === "Reset" ? client.emoji.warn : client.emoji.check,
        }));

        const presetMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("eq_preset")
                .setPlaceholder("Select an equalizer preset")
                .addOptions(presetOptions),
        );

        const bandMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("eq_band")
                .setPlaceholder("Select a band to adjust")
                .addOptions(
                    EQUALIZER_BANDS.map(({ band, label }) => ({
                        label: `${label} (Band ${band})`,
                        value: `band_${band}`,
                        emoji: "🎛️",
                    }))
                ),
        );

        const eqDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.info} Equalizer**\n\`\`\`\n${buildEqualizerDisplay(currentGains)}\n\`\`\``);

        const eqContainer = new ContainerBuilder()
            .addTextDisplayComponents(eqDisplay)
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(presetMenu, bandMenu);

        const eqMessage = await message.channel.send({
            components: [eqContainer],
            flags: MessageFlags.IsComponentsV2
        });

        const collector = eqMessage.createMessageComponentCollector({
            filter: (i) => {
                if (message.author.id === i.user.id) return true;
                else {
                    const errorDisplay = new TextDisplayBuilder()
                        .setContent(`**${client.emoji.warn} That's not your session run. Use \`${prefix}equalizer\` to create your own.**`);

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

            if (i.customId === "eq_preset") {
                const presetName = i.values[0].replace(/_/g, " ");
                const preset = PRESETS[presetName];

                if (preset) {
                    await player.shoukaku.setFilters({ equalizer: preset });
                } else {
                    await player.shoukaku.clearFilters();
                }

                const presetGains = {};
                EQUALIZER_BANDS.forEach(({ band }) => {
                    presetGains[band] = 0;
                });
                preset.forEach(({ band, gain }) => {
                    presetGains[band] = gain;
                });

                const updatedDisplay = new TextDisplayBuilder()
                    .setContent(`**${client.emoji.info} Equalizer Preset: \`${presetName}\`**\n\`\`\`\n${buildEqualizerDisplay(presetGains)}\n\`\`\``);

                const updatedContainer = new ContainerBuilder()
                    .addTextDisplayComponents(updatedDisplay)
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addActionRowComponents(presetMenu, bandMenu);

                await eqMessage.edit({
                    components: [updatedContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } else if (i.customId === "eq_band") {
                const band = parseInt(i.values[0].replace("band_", ""));

                const modal = new ModalBuilder()
                    .setCustomId(`eq_band_${band}`)
                    .setTitle(`Adjust Band ${band} - ${EQUALIZER_BANDS[band].label}`);

                const bandInput = new TextInputBuilder()
                    .setCustomId("gain_value")
                    .setLabel("Gain (-0.25 to 1.0)")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("0.5")
                    .setRequired(true);

                const modalRow = new ActionRowBuilder().addComponents(bandInput);
                modal.addComponents(modalRow);

                await i.showModal(modal);
            }

            await i.deferUpdate();
        });

        collector.on("end", async () => {
            if (!eqMessage.deleted) {
                await eqMessage.delete().catch(() => { });
            }
        });
    },

    async handleModalSubmit(interaction, client, player) {
        const band = parseInt(interaction.customId.replace("eq_band_", ""));
        const gainValue = parseFloat(interaction.fields.getTextInputValue("gain_value"));

        if (isNaN(gainValue) || gainValue < -0.25 || gainValue > 1.0) {
            return interaction.reply({
                content: `**${client.emoji.warn} Invalid gain value. Must be between -0.25 and 1.0**`,
                flags: MessageFlags.Ephemeral
            });
        }

        const currentFilters = player.shoukaku?.filters || {};
        const equalizer = currentFilters.equalizer || [];
        const bandIndex = equalizer.findIndex((e) => e.band === band);

        if (bandIndex >= 0) {
            equalizer[bandIndex].gain = gainValue;
        } else {
            equalizer.push({ band, gain: gainValue });
        }

        await player.shoukaku.setFilters({ equalizer });

        const updatedDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.check} Band ${band} (${EQUALIZER_BANDS[band].label}) set to \`${gainValue}\`**`);

        const updatedContainer = new ContainerBuilder()
            .addTextDisplayComponents(updatedDisplay);

        await interaction.reply({
            components: [updatedContainer],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
        });
    }
};
