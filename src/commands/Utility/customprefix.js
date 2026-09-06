const {
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const emoji = require("../../emojis");
const PrefixSchema = require("../../schema/prefix");
const AliasSchema = require("../../schema/alias");

module.exports = {
    name: "customprefix",
    aliases: ["cp", "myalias", "alias"],
    category: "Utility",
    description: "Set your custom prefix or create custom command aliases",
    cooldown: 3,
    args: true,
    usage: "<prefix> <command> | view | clear",
    userPerms: [],
    slashOptions: [
        {
            name: "action",
            description: "Action to perform",
            type: 3,
            required: true,
            choices: [
                { name: "Set custom prefix", value: "set" },
                { name: "View my settings", value: "view" },
                { name: "Clear my settings", value: "clear" },
            ]
        },
        {
            name: "prefix",
            description: "Your custom prefix (1-3 characters)",
            type: 3,
            required: false,
        },
        {
            name: "alias",
            description: "Custom command alias (e.g., 'atih' for profile)",
            type: 3,
            required: false,
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
        const userId = message.author.id;
        const action = args[0]?.toLowerCase();

        if (!action || action === "view") {
            return await this.viewSettings(message, client, prefix);
        }

        if (action === "clear") {
            return await this.clearSettings(message, client, userId, prefix);
        }

        if (action === "set") {
            return await this.setPrefix(message, args, client, userId, prefix);
        }

        // Legacy: customprefix <prefix> <command>
        if (args.length >= 2) {
            return await this.setAlias(message, args, client, userId, prefix);
        }

        const helpDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.info} Custom Prefix Usage**\n\n` +
                `**Set your custom prefix:**\n` +
                `\`${prefix}customprefix set <prefix>\`\n` +
                `Example: \`${prefix}customprefix set f\`\n\n` +
                `**Create custom alias:**\n` +
                `\`${prefix}customprefix set <prefix> <command>\`\n` +
                `Example: \`${prefix}customprefix set f atih profile\`\n\n` +
                `**View your settings:**\n` +
                `\`${prefix}customprefix view\`\n\n` +
                `**Clear your settings:**\n` +
                `\`${prefix}customprefix clear\``);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(helpDisplay);

        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    },

    async viewSettings(message, client, prefix) {
        const userId = message.author.id;

        const [userPrefix, aliases] = await Promise.all([
            PrefixSchema.findOne({ Guild: userId, isUser: true }).lean(),
            AliasSchema.find({ userId }).lean(),
        ]);

        const currentPrefix = userPrefix?.Prefix || client.prefix;
        const aliasList = aliases.map(a => `\`${a.prefix}${a.alias}\` → \`${a.command}\``).join("\n") || "None";

        const display = new TextDisplayBuilder()
            .setContent(`**${client.emoji.info} Your Custom Settings**\n\n` +
                `**Your Prefix:** \`${currentPrefix}\`\n\n` +
                `**Your Aliases:**\n${aliasList}`);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(display);

        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    },

    async setPrefix(message, args, client, userId, prefix) {
        const newPrefix = args[1];

        if (!newPrefix || newPrefix.length < 1 || newPrefix.length > 3) {
            const errorDisplay = new TextDisplayBuilder()
                .setContent(`**${client.emoji.warn} Prefix must be 1-3 characters**`);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(errorDisplay);

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        await PrefixSchema.findOneAndUpdate(
            { Guild: userId, isUser: true },
            { Prefix: newPrefix },
            { upsert: true, new: true }
        );

        client.prefix = newPrefix;

        const successDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.check} Your custom prefix has been set to: \`${newPrefix}\`**\n\n` +
                `Example: \`${newPrefix}play lofi\``);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(successDisplay);

        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    },

    async setAlias(message, args, client, userId, prefix) {
        const userPrefix = args[0];
        const alias = args[1];
        const command = args.slice(2).join(" ") || args[1];

        if (!userPrefix || !alias) {
            const errorDisplay = new TextDisplayBuilder()
                .setContent(`**${client.emoji.warn} Usage: \`${prefix}customprefix <prefix> <alias> <command>\`\n` +
                    `Example: \`${prefix}customprefix f atih profile\``);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(errorDisplay);

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        await AliasSchema.findOneAndUpdate(
            { userId, prefix: userPrefix, alias },
            { command, updatedAt: Date.now() },
            { upsert: true, new: true }
        );

        const successDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.check} Custom alias created!**\n\n` +
                `Type \`${userPrefix}${alias}\` to run \`${command}\``);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(successDisplay);

        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    },

    async clearSettings(message, client, userId, prefix) {
        await PrefixSchema.deleteOne({ Guild: userId, isUser: true });
        await AliasSchema.deleteMany({ userId });

        client.prefix = prefix;

        const successDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.check} Your custom settings have been cleared.**\n\n` +
                `Prefix reset to: \`${prefix}\``);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(successDisplay);

        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
