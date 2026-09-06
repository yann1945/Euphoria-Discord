const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    AttachmentBuilder,
} = require('discord.js');
const { generateProfileCard } = require('../../utils/profileCardHtml');
const { getLevel, calculateRequiredXP } = require('../../utils/levelSystem');

const PROFILE_FILE = "profile-card.jpg";

module.exports = {
    name: 'profile',
    aliases: ['pf', 'card'],
    description: "Show your music profile card",
    category: 'Utility',
    slashOptions: [
        {
            name: 'user',
            description: 'The user whose profile you want to see',
            type: 6,
            required: false
        }
    ],
    args: false,
    usage: "[user]",
    userPerms: [],
    owner: false,

    async slashExecute(interaction, client) {
        const interactionWrapper = {
            guild: interaction.guild,
            channel: interaction.channel,
            author: interaction.user,
            member: interaction.member,
            createdTimestamp: interaction.createdTimestamp,
            mentions: {
                users: interaction.options.getUser('user') ? new Map([[interaction.options.getUser('user').id, interaction.options.getUser('user')]]) : new Map()
            },
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
        const user = interaction.options.getUser('user');
        if (user) {
            args.push(user.id);
        }

        const prefix = client.prefix;
        return this.execute(interactionWrapper, args, client, prefix);
    },

    async execute(message, args, client) {
        let userId;

        if (args.length > 0) {
            if (message.mentions.users.size > 0) {
                userId = Array.from(message.mentions.users.values())[0].id;
            } else {
                userId = args[0];
            }
        } else {
            userId = message.author.id;
        }

        let user;
        try {
            user = await client.users.fetch(userId, { force: true });
        } catch (error) {
            const errorDisplay = new TextDisplayBuilder()
                .setContent(`${client.emoji.cross} Could not fetch user data.`);

            const errorContainer = new ContainerBuilder()
                .addTextDisplayComponents(errorDisplay);

            return message.reply({
                content: '',
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (user.bot) {
            const errorDisplay = new TextDisplayBuilder()
                .setContent(`${client.emoji.cross} You cannot tag a bot`);

            const errorContainer = new ContainerBuilder()
                .addTextDisplayComponents(errorDisplay);

            return message.reply({
                content: '',
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const loading = await message.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${client.emoji.load} Generating profile card\n-# Please wait...`)
            )],
            flags: MessageFlags.IsComponentsV2
        });

        try {
            const [liked, playlistLib, levelData] = await Promise.all([
                require("../../schema/liked.js").findOne({ userId }).lean(),
                require("../../schema/playlist.js").findOne({ userId }).lean(),
                getLevel(userId),
            ]);

            const userLevel = {
                level: levelData.level,
                xp: levelData.xp,
                requiredXP: calculateRequiredXP(levelData.level),
            };

            const topTracks = (liked?.songs || [])
                .slice(0, 3)
                .map((s, i) => ({ n: s.title || `Track ${i + 1}`, d: s.duration || "—" }));

            const tracks = topTracks.length ? topTracks : [{ n: "No tracks yet", d: "—" }];
            const servers = [
                { n: "Voice time coming soon", d: "—" },
                { n: "Voice time coming soon", d: "—" },
                { n: "Voice time coming soon", d: "—" },
            ];
            const friends = [
                { n: "Friend data coming soon", d: "—" },
                { n: "Friend data coming soon", d: "—" },
                { n: "Friend data coming soon", d: "—" },
            ];

            const buffer = await generateProfileCard({
                username: user.displayName || user.username || "Unknown",
                avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }),
                likes: liked?.songs?.length || 0,
                playlists: playlistLib?.playlists?.length || 0,
                streams: "—",
                servers,
                friends,
                tracks,
                level: userLevel.level,
                xp: userLevel.xp,
                requiredXP: userLevel.requiredXP,
            });

            if (!buffer || (Buffer.isBuffer(buffer) && buffer.length === 0)) {
                console.error('[Profile] Empty profile card buffer');
                throw new Error('Failed to generate profile card');
            }

            if (!Buffer.isBuffer(buffer)) {
                buffer = Buffer.from(buffer);
            }

            const attachment = new AttachmentBuilder(buffer, { name: PROFILE_FILE });

            const header = new TextDisplayBuilder()
                .setContent(`### ${user.displayName || user.username}'s Profile\n-# Requested by ${message.author.username} • <t:${Math.floor(Date.now() / 1000)}:t>`);

            const separator = new SeparatorBuilder();

            const mediaItem = new MediaGalleryItemBuilder()
                .setURL(`attachment://${PROFILE_FILE}`);

            const mediaGallery = new MediaGalleryBuilder()
                .addItems(mediaItem);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(header)
                .addSeparatorComponents(separator)
                .addMediaGalleryComponents(mediaGallery);

            await loading.edit({
                content: '',
                components: [container],
                files: [attachment],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            console.error('[Profile]', error);

            const errorDisplay = new TextDisplayBuilder()
                .setContent(`${client.emoji.cross} Failed to generate profile card: ${error.message}`);

            const errorContainer = new ContainerBuilder()
                .addTextDisplayComponents(errorDisplay);

            await loading.edit({
                content: '',
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};
