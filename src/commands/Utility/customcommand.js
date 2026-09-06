const {
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const emoji = require("../../emojis");
const CustomCommandSchema = require("../../schema/customCommand");

module.exports = {
    name: "customcommand",
    aliases: ["cc", "mycommand", "mycmd"],
    category: "Utility",
    description: "Create and manage your custom commands",
    cooldown: 3,
    args: true,
    usage: "create <name> <response> | delete <name> | list | clear",
    userPerms: [],
    slashOptions: [
        {
            name: "action",
            description: "Action to perform",
            type: 3,
            required: true,
            choices: [
                { name: "Create custom command", value: "create" },
                { name: "Delete custom command", value: "delete" },
                { name: "List my commands", value: "list" },
                { name: "Clear all commands", value: "clear" },
            ]
        },
        {
            name: "name",
            description: "Command name",
            type: 3,
            required: false,
        },
        {
            name: "response",
            description: "Command response text",
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

        if (!action || action === "list") {
            return await this.listCommands(message, client, userId, prefix);
        }

        if (action === "clear") {
            return await this.clearCommands(message, client, userId, prefix);
        }

        if (action === "delete") {
            return await this.deleteCommand(message, args, client, userId, prefix);
        }

        if (action === "create") {
            return await this.createCommand(message, args, client, userId, prefix);
        }

        const helpDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.info} Custom Command Usage**\n\n` +
                `**Create custom command:**\n` +
                `\`${prefix}customcommand create <name> <response>\`\n` +
                `Example: \`${prefix}customcommand create halo Halo semuanya!\`\n\n` +
                `**Delete custom command:**\n` +
                `\`${prefix}customcommand delete <name>\`\n` +
                `Example: \`${prefix}customcommand delete halo\`\n\n` +
                `**List your commands:**\n` +
                `\`${prefix}customcommand list\`\n\n` +
                `**Clear all commands:**\n` +
                `\`${prefix}customcommand clear\``);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(helpDisplay);

        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    },

    async createCommand(message, args, client, userId, prefix) {
        const name = args[1]?.toLowerCase();
        const response = args.slice(2).join(" ");

        if (!name || !response) {
            const errorDisplay = new TextDisplayBuilder()
                .setContent(`**${client.emoji.warn} Usage: \`${prefix}customcommand create <name> <response>\`\n` +
                    `Example: \`${prefix}customcommand create halo Halo semuanya!\``);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(errorDisplay);

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (name.length < 2 || name.length > 20) {
            const errorDisplay = new TextDisplayBuilder()
                .setContent(`**${client.emoji.warn} Command name must be 2-20 characters**`);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(errorDisplay);

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (response.length > 500) {
            const errorDisplay = new TextDisplayBuilder()
                .setContent(`**${client.emoji.warn} Response must be less than 500 characters**`);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(errorDisplay);

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        try {
            await CustomCommandSchema.findOneAndUpdate(
                { userId, name },
                { response, updatedAt: Date.now() },
                { upsert: true, new: true }
            );

            const successDisplay = new TextDisplayBuilder()
                .setContent(`**${client.emoji.check} Custom command created!**\n\n` +
                    `**Name:** \`${name}\`\n` +
                    `**Response:** \`${response}\`\n\n` +
                    `Use it with: \`${prefix}${name}\``);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(successDisplay);

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            const errorDisplay = new TextDisplayBuilder()
                .setContent(`**${client.emoji.cross} Failed to create command: ${error.message}**`);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(errorDisplay);

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },

    async deleteCommand(message, args, client, userId, prefix) {
        const name = args[1]?.toLowerCase();

        if (!name) {
            const errorDisplay = new TextDisplayBuilder()
                .setContent(`**${client.emoji.warn} Usage: \`${prefix}customcommand delete <name>\`\n` +
                    `Example: \`${prefix}customcommand delete halo\``);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(errorDisplay);

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const result = await CustomCommandSchema.findOneAndDelete({ userId, name });

        if (!result) {
            const errorDisplay = new TextDisplayBuilder()
                .setContent(`**${client.emoji.warn} Command \`${name}\` not found**`);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(errorDisplay);

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const successDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.check} Command \`${name}\` deleted**`);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(successDisplay);

        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    },

    async listCommands(message, client, userId, prefix) {
        const commands = await CustomCommandSchema.find({ userId }).lean();

        if (commands.length === 0) {
            const display = new TextDisplayBuilder()
                .setContent(`**${client.emoji.info} You don't have any custom commands yet.**\n\n` +
                    `Create one with: \`${prefix}customcommand create <name> <response>\``);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(display);

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const commandList = commands.map(cmd => 
            `\`${cmd.name}\` → \`${cmd.response.slice(0, 50)}${cmd.response.length > 50 ? '...' : ''}\``
        ).join("\n");

        const display = new TextDisplayBuilder()
            .setContent(`**${client.emoji.info} Your Custom Commands** (${commands.length})\n\n${commandList}`);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(display);

        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    },

    async clearCommands(message, client, userId, prefix) {
        const result = await CustomCommandSchema.deleteMany({ userId });

        const successDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.check} Deleted ${result.deletedCount} custom commands**`);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(successDisplay);

        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
