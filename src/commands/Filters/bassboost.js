const {
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags
} = require('discord.js');
const emoji = require("../../emojis");

const BASS_GAINS = {
    1: [{ band: 0, gain: 0.3 }, { band: 1, gain: 0.25 }, { band: 2, gain: 0.2 }, { band: 3, gain: 0.1 }],
    2: [{ band: 0, gain: 0.5 }, { band: 1, gain: 0.4 }, { band: 2, gain: 0.35 }, { band: 3, gain: 0.2 }, { band: 4, gain: 0.1 }],
    3: [{ band: 0, gain: 0.7 }, { band: 1, gain: 0.6 }, { band: 2, gain: 0.5 }, { band: 3, gain: 0.4 }, { band: 4, gain: 0.3 }, { band: 5, gain: 0.2 }],
};

module.exports = {
    name: "bassboost",
    aliases: ["bass"],
    category: "Filters",
    description: "Enable bassboost effect (levels 1-3)",
    cooldown: 3,
    args: true,
    usage: "<1-3>",
    userPerms: [],
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    slashOptions: [
        {
            name: "level",
            description: "Bassboost level (1-3)",
            type: 4,
            required: true,
            min_value: 1,
            max_value: 3
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

        const level = parseInt(args[0]) || 1;
        
        if (level < 1 || level > 3) {
            const errorDisplay = new TextDisplayBuilder()
                .setContent(`**${client.emoji.warn} Bassboost level must be 1-3**`);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(errorDisplay);

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        await player.shoukaku.setFilters({ equalizer: BASS_GAINS[level] });
        player.currentFilter = `Bassboost ${level}`;

        const successDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.check} Bassboost level \`${level}\` enabled**`);

        const successContainer = new ContainerBuilder()
            .addTextDisplayComponents(successDisplay);

        return message.reply({
            components: [successContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
