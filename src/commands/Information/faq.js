const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    MessageFlags,
} = require('discord.js');
const emoji = require("../../emojis");

const FAQ_DATA = {
    "general": {
        label: "General",
        emoji: emoji.info,
        questions: [
            {
                q: "What is Euphoria Music?",
                a: "Euphoria Music is a powerful Discord music bot that plays high-quality music from YouTube, Spotify, and other platforms. It supports filters, lyrics, queue management, and more."
            },
            {
                q: "How do I play music?",
                a: "Use the play command: `eu play <song name or URL>`\nExample: `eu play never gonna give you up`"
            },
            {
                q: "What music sources are supported?",
                a: "YouTube, Spotify, SoundCloud, Deezer, Apple Music, JioSaavn, and more. Just paste the link or search by name."
            },
            {
                q: "Is the bot free?",
                a: "Yes! Euphoria Music is completely free to use. There are no premium features or paid tiers."
            }
        ]
    },
    "commands": {
        label: "Commands",
        emoji: emoji.utility,
        questions: [
            {
                q: "How do I see all commands?",
                a: "Type `eu help` to see all available commands, or `eu help <command>` for detailed information about a specific command."
            },
            {
                q: "What are the music commands?",
                a: "Common music commands:\n`eu play` - Play a song\n`eu skip` - Skip current song\n`eu pause` - Pause playback\n`eu resume` - Resume playback\n`eu queue` - View queue\n`eu shuffle` - Shuffle queue\n`eu loop` - Toggle loop mode"
            },
            {
                q: "What filter commands are available?",
                a: "Available filters:\n`eu bassboost <1-3>` - Bass boost effect\n`eu nightcore` - Nightcore effect\n`eu vaporwave` - Vaporwave effect\n`eu 8d` - 8D audio effect\n`eu filter` - All filters menu"
            }
        ]
    },
    "levels": {
        label: "Levels",
        emoji: emoji.star,
        questions: [
            {
                q: "How does the level system work?",
                a: "You earn 10 XP every minute while listening to music in a voice channel with the bot. Level up requires more XP each level (100 × level²)."
            },
            {
                q: "What are the benefits of leveling up?",
                a: "Higher levels unlock:\n- Volume boost up to 150%/200%\n- Priority queue slots\n- More playlist slots\n- Custom badges and cosmetics"
            },
            {
                q: "How can I check my level?",
                a: "Use `eu profile` to see your level, or check the help menu which shows your current level."
            }
        ]
    },
    "support": {
        label: "Support",
        emoji: emoji.warn,
        questions: [
            {
                q: "The bot is not responding",
                a: "Check if the bot is online and has the necessary permissions. Try rejoining the voice channel or using `eu leave` then `eu join`."
            },
            {
                q: "Music is lagging or buffering",
                a: "This is usually due to Lavalink server issues. Try again in a few minutes, or contact support if the problem persists."
            },
            {
                q: "How do I report bugs?",
                a: "Join our support server and report bugs in the #bug-reports channel. Please include the command used and error message."
            },
            {
                q: "Can I invite the bot to my server?",
                a: "Yes! Use `eu invite` to get the invite link. Make sure to give the bot proper permissions."
            }
        ]
    }
};

module.exports = {
    name: "faq",
    aliases: ["questions", "help faq", "frequently"],
    category: "Information",
    description: "Frequently asked questions about the bot",
    cooldown: 3,
    args: false,
    usage: "",
    userPerms: [],
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

        const prefix = client.prefix;
        return this.execute(interactionWrapper, [], client, prefix);
    },

    async execute(message, args, client, prefix) {
        const categories = Object.entries(FAQ_DATA);
        
        const categoryOptions = categories.map(([key, data]) => ({
            label: data.label,
            value: key,
            emoji: data.emoji,
            description: `${data.questions.length} questions`,
        }));

        const categoryMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("faq_category")
                .setPlaceholder("Select a category")
                .addOptions(categoryOptions)
        );

        const faqDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.info} Frequently Asked Questions**\n\n` +
                `Select a category below to see questions and answers.\n\n` +
                `**Categories:**\n${categories.map(([key, data]) => `${data.emoji} ${data.label}`).join('\n')}`);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(faqDisplay)
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(categoryMenu);

        const faqMessage = await message.channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        const collector = faqMessage.createMessageComponentCollector({
            filter: (i) => {
                if (message.author.id === i.user.id) return true;
                else {
                    const errorDisplay = new TextDisplayBuilder()
                        .setContent(`**${client.emoji.warn} That's not your session run. Use \`${prefix}faq\` to create your own.`);

                    const errorContainer = new ContainerBuilder()
                        .addTextDisplayComponents(errorDisplay);

                    i.reply({
                        components: [errorContainer],
                        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
                    });
                    return false;
                }
            },
            time: 120000,
            idle: 60000,
        });

        collector.on("collect", async (i) => {
            if (!i.isStringSelectMenu()) return;

            const categoryKey = i.values[0];
            const categoryData = FAQ_DATA[categoryKey];

            if (!categoryData) return;

            const questions = categoryData.questions.map((q, index) => 
                `**Q${index + 1}: ${q.q}**\nA: ${q.a}`
            ).join('\n\n');

            const questionDisplay = new TextDisplayBuilder()
                .setContent(`**${categoryData.emoji} ${categoryData.label} FAQ**\n\n${questions}`);

            const updatedContainer = new ContainerBuilder()
                .addTextDisplayComponents(questionDisplay)
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(categoryMenu);

            await faqMessage.edit({
                components: [updatedContainer],
                flags: MessageFlags.IsComponentsV2
            });

            await i.deferUpdate();
        });

        collector.on("end", async () => {
            if (!faqMessage.deleted) {
                const endDisplay = new TextDisplayBuilder()
                    .setContent(`**${client.emoji.info} FAQ menu expired**\nRun \`${prefix}faq\` again to view FAQs.`);

                const endContainer = new ContainerBuilder()
                    .addTextDisplayComponents(endDisplay);

                await faqMessage.edit({
                    components: [endContainer],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});
            }
        });
    }
};
