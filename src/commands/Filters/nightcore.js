const {
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags
} = require('discord.js');
const emoji = require("../../emojis");

module.exports = {
    name: "nightcore",
    aliases: ["nc"],
    category: "Filters",
    description: "Enable nightcore effect",
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

        await player.shoukaku.setFilters({ timescale: { speed: 1.15, pitch: 1.2, rate: 1.0 } });
        player.currentFilter = "Nightcore";

        const successDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.check} Nightcore effect enabled**`);

        const successContainer = new ContainerBuilder()
            .addTextDisplayComponents(successDisplay);

        return message.reply({
            components: [successContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
