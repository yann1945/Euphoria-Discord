const {
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags
} = require('discord.js');
const emoji = require("../../emojis");

module.exports = {
    name: "8d",
    aliases: ["8daudio", "8d audio"],
    category: "Filters",
    description: "Enable 8D audio effect",
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

        await player.shoukaku.setFilters({ rotation: { rotationHz: 0.2 } });
        player.currentFilter = "8D Audio";

        const successDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.check} 8D Audio effect enabled**`);

        const successContainer = new ContainerBuilder()
            .addTextDisplayComponents(successDisplay);

        return message.reply({
            components: [successContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
