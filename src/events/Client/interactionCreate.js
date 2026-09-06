const {
  CommandInteraction,
  InteractionType,
  PermissionFlagsBits,
  PermissionsBitField,
  EmbedBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const db = require("../../schema/prefix.js");
const db3 = require("../../schema/setup");
const { sendWebhook } = require("../../utils/webhooks");
const { playPreviousTrack } = require("../../utils/previousTrack");
const { setAutoplay, setLoopMode, stopPlaybackModes } = require("../../utils/playbackModes");
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, SeparatorBuilder } = require("discord.js");
const lyricsFinder = require("@flytri/lyrics-finder");
const axios = require("axios");

module.exports = {
  name: "interactionCreate",
  run: async (client, interaction) => {
    await client.emojiReady?.catch(() => {});
    let prefix = client.prefix;
    const ress = await db.findOne({ Guild: interaction.guildId });
    if (ress && ress.Prefix) prefix = ress.Prefix;

    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      const command = client.slashCommands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;

      try {
        await command.autocomplete(interaction, client);
      } catch (error) {
        console.error(`Autocomplete error for ${interaction.commandName}:`, error);
        client.logger.log(`Autocomplete error for ${interaction.commandName}: ${error.stack}`, "error");
      }
      return;
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
      if (!client.slashCommands) {
        client.logger.log("Slash commands collection is not initialized", "error");
        return;
      }

      const command = client.slashCommands.get(interaction.commandName);
      if (!command) return;

      if (command.botPerms) {
        if (
          !interaction.guild.members.me.permissions.has(
            PermissionsBitField.resolve(command.botPerms || []),
          )
        ) {
          const errorDisplay = new TextDisplayBuilder()
            .setContent(
              `**${client.emoji.warn} I don't have \`${command.botPerms}\` permission in ${interaction.channel.toString()} to execute this \`${command.name}\` command.**`
            );

          const container = new ContainerBuilder()
            .addTextDisplayComponents(errorDisplay);

          return interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
          });
        }
      }

      if (command.userPerms) {
        if (
          !interaction.member.permissions.has(
            PermissionsBitField.resolve(command.userPerms || []),
          )
        ) {
          const errorDisplay = new TextDisplayBuilder()
            .setContent(
              `**${client.emoji.warn} You don't have \`${command.userPerms}\` permission in ${interaction.channel.toString()} to execute this \`${command.name}\` command.**`
            );

          const container = new ContainerBuilder()
            .addTextDisplayComponents(errorDisplay);

          return interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
          });
        }
      }

      const player = interaction.client.manager.players.get(
        interaction.guildId,
      );
      if (command.player && !player) {
        const errorDisplay = new TextDisplayBuilder()
          .setContent(`**${client.emoji.warn} There is no player for this guild.**`);

        const container = new ContainerBuilder()
          .addTextDisplayComponents(errorDisplay);

        if (interaction.replied) {
          return await interaction
            .editReply({
              components: [container],
              flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            })
            .catch(() => { });
        } else {
          return await interaction
            .reply({
              components: [container],
              flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            })
            .catch(() => { });
        }
      }
      if (command.inVoiceChannel && !interaction.member.voice.channel) {
        const errorDisplay = new TextDisplayBuilder()
          .setContent(`**${client.emoji.warn} You must be in a voice channel.**`);

        const container = new ContainerBuilder()
          .addTextDisplayComponents(errorDisplay);

        if (interaction.replied) {
          return await interaction
            .editReply({
              components: [container],
              flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            })
            .catch(() => { });
        } else {
          return await interaction
            .reply({
              components: [container],
              flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            })
            .catch(() => { });
        }
      }
      if (command.sameVoiceChannel) {
        if (!interaction.guild || !interaction.guild.members.me) {
          const errorDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.warn} An error occurred. It seems the bot is not properly connected to the guild.**`);

          const container = new ContainerBuilder()
            .addTextDisplayComponents(errorDisplay);

          return await interaction
            .reply({
              components: [container],
              flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            })
            .catch(() => { });
        }

        const botVoiceChannel = interaction.guild.members.me.voice.channel;
        const userVoiceChannel = interaction.member.voice.channel;

        if (botVoiceChannel) {
          if (userVoiceChannel !== botVoiceChannel) {
            const errorDisplay = new TextDisplayBuilder()
              .setContent(`**${client.emoji.warn} You must be in the same ${botVoiceChannel.toString()} to use this command.**`);

            const container = new ContainerBuilder()
              .addTextDisplayComponents(errorDisplay);

            return await interaction
              .reply({
                components: [container],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
              })
              .catch(() => { });
          }
        }
      }

      try {
        const interactionWrapper = {
          guild: interaction.guild,
          channel: interaction.channel,
          author: interaction.user,
          member: interaction.member,
          createdTimestamp: interaction.createdTimestamp,
          mentions: {
            channels: new Map()
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
        if (interaction.options) {
          const action = interaction.options.getString('action');
          const channel = interaction.options.getChannel('channel');
          const prefix = interaction.options.getString('prefix');
          const source = interaction.options.getString('source');
          const query = interaction.options.getString('query');
          const song = interaction.options.getString('song');
          const name = interaction.options.getString('name');
          const input = interaction.options.getString('input');
          const text = interaction.options.getString('text');
          const number = interaction.options.getInteger('number');
          const amount = interaction.options.getInteger('amount');
          const position = interaction.options.getInteger('position');

          if (action) args.push(action);
          if (channel) {
            args.push(channel.id);
            interactionWrapper.mentions.channels.set(channel.id, channel);
            interactionWrapper.mentions.channels.first = () => channel;
          }
          if (prefix) args.push(prefix);
          if (source) args.push(source);
          if (query) args.push(...query.split(' '));
          if (song) args.push(...song.split(' '));
          if (name) args.push(...name.split(' '));
          if (input) args.push(...input.split(' '));
          if (text) args.push(...text.split(' '));
          if (number !== null && number !== undefined) args.push(number.toString());
          if (amount !== null && amount !== undefined) args.push(amount.toString());
          if (position !== null && position !== undefined) args.push(position.toString());
        }

        if (command.slashExecute) {
          await command.slashExecute(interaction, client);
        } else if (command.execute) {
          await command.execute(interactionWrapper, args, client, prefix);
        } else if (command.run) {
          await command.run(client, interactionWrapper, prefix);
        }

        if (client.config.Webhooks?.cmdrun) {
          const getCommandString = () => {
            let cmdString = `/${interaction.commandName}`;
            if (interaction.options) {
              const subcommand = interaction.options.getSubcommand(false);
              if (subcommand) {
                cmdString += ` ${subcommand}`;
              }
              const options = interaction.options.data;
              if (options && options.length > 0) {
                const optionStrings = options
                  .filter(opt => opt.type !== 1)
                  .map(opt => `${opt.name}:${opt.value}`)
                  .join(' ');
                if (optionStrings) cmdString += ` ${optionStrings}`;
              }
            }
            return cmdString;
          };

          const commandlog = new EmbedBuilder()
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setColor(client.color)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp()
            .setDescription(
              `**${client.emoji.dot} Command Used In:** \`${interaction.guild.name} | ${interaction.guild.id}\`\n` +
              `**${client.emoji.dot} Channel:** \`${interaction.channel.name} | ${interaction.channel.id}\`\n` +
              `**${client.emoji.dot} Command:** \`${command.name}\` (Slash)\n` +
              `**${client.emoji.dot} Executor:** \`${interaction.user.tag} | ${interaction.user.id}\`\n` +
              `**${client.emoji.dot} Content:** \`${getCommandString()}\``
            );

          await sendWebhook(client, "cmdrun", { embeds: [commandlog] });
        }

      } catch (error) {
        const errorDisplay = new TextDisplayBuilder()
          .setContent(`**${client.emoji.warn} An unexpected error occurred.**`);

        const container = new ContainerBuilder()
          .addTextDisplayComponents(errorDisplay);

        if (interaction.replied) {
          await interaction
            .editReply({
              components: [container],
              flags: MessageFlags.IsComponentsV2,
            })
            .catch(() => { });
        } else {
          await interaction
            .reply({
              components: [container],
              flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            })
            .catch(() => { });
        }
        client.logger.log(`Interaction Error: ${error.stack}`, "error");
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'bioset_modal' || interaction.customId.startsWith('bio_')) {
        try {
          const command = require("../../commands/Profile/bioset");
          await command.modalHandler(interaction);
        } catch (error) {
          client.logger.log(`Error handling bioset modal submission: ${error.stack}`, "error");

          const errorDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.warn} There was an error processing your input. Please try again.**`);

          const container = new ContainerBuilder()
            .addTextDisplayComponents(errorDisplay);

          await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          }).catch(() => { });
        }
      }
    }

    if (interaction.isButton()) {
      const customIdParts = interaction.customId.split('_');
      const potentialCommandName = customIdParts[0];

      let command = client.commands.get(potentialCommandName);

      if (!command) {
        const commandName = client.aliases.get(potentialCommandName);
        if (commandName) {
          command = client.commands.get(commandName);
        }
      }

      if (command && typeof command.componentsV2 === 'function') {
        try {
          await command.componentsV2(interaction, client);
          return;
        } catch (error) {
          client.logger.log(`Error executing componentsV2 for ${potentialCommandName}: ${error.stack}`, "error");

          const errorDisplay = new TextDisplayBuilder()
            .setContent(`**${client.emoji.cross} An error occurred while processing this interaction.**`);

          const errorContainer = new ContainerBuilder()
            .addTextDisplayComponents(errorDisplay);

          const errorMessage = {
            components: [errorContainer],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
          };

          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage).catch(() => { });
          } else {
            await interaction.reply(errorMessage).catch(() => { });
          }
          return;
        }
      }

      // Handle Now Playing Buttons
      const player = client.manager.players.get(interaction.guildId);
      if (player && player.data.get("nowPlayingMessage")?.id === interaction.message.id) {
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceId) {
          return interaction.reply({ content: `**${client.emoji.warn} You must be in my voice channel to use these buttons.**`, ephemeral: true });
        }

        const { updateNowPlayingButtons } = require("../Players/playerStart");

        switch (interaction.customId) {
          case "previous":
            try {
              const previousTrack = await playPreviousTrack(player, interaction.user);
              await interaction.reply({
                content: `**${client.emoji.check} Playing previous track: [${previousTrack.title}](${previousTrack.uri})**`,
                ephemeral: true,
              });
            } catch (error) {
              const message = error.code === "NO_HISTORY"
                ? "No previous songs are available yet."
                : "The previous track could not be restored.";
              await interaction.reply({ content: `**${client.emoji.info} ${message}**`, ephemeral: true });
            }
            break;

          case "pause":
            const isPaused = !player.shoukaku.paused;
            await player.pause(isPaused);
            await updateNowPlayingButtons(client, player, isPaused);
            await interaction.reply({ 
              content: `**${client.emoji.check} Player ${isPaused ? "Paused" : "Resumed"}**`, 
              ephemeral: true 
            }).catch(() => { });
            break;

          case "skip":
            await player.skip();
            await interaction.reply({ 
              content: `**${client.emoji.check} Skipped current track**`, 
              ephemeral: true 
            }).catch(() => { });
            break;

          case "stop":
            player.queue.clear();
            stopPlaybackModes(player);
            await player.skip();
            await interaction.reply({ 
              content: `**${client.emoji.check} Player Stopped**`, 
              ephemeral: true 
            }).catch(() => { });
            break;

          case "loop":
            const modes = ["none", "track", "queue"];
            const currentModeIndex = modes.indexOf(player.loop || "none");
            const nextMode = modes[(currentModeIndex + 1) % modes.length];
            setLoopMode(player, nextMode);
            await updateNowPlayingButtons(client, player, player.shoukaku.paused);
            await interaction.reply({ 
              content: `**${client.emoji.check} Loop mode set to: \`${nextMode.charAt(0).toUpperCase() + nextMode.slice(1)}\`**`, 
              ephemeral: true 
            }).catch(() => { });
            break;

          case "autoplay":
            const currentAuto = player.data.get("autoplay") || false;
            const newAutoStatus = !currentAuto;
            const { disabledLoop } = setAutoplay(player, newAutoStatus);
            await updateNowPlayingButtons(client, player, player.shoukaku.paused);
            await interaction.reply({ 
              content: `**${client.emoji.check} Autoplay has been \`${newAutoStatus ? "Enabled" : "Disabled"}\`**${disabledLoop ? "\nLoop was disabled." : ""}`,
              ephemeral: true 
            }).catch(() => { });
            break;

          case "lyrics":
            await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
            
            const track = player.queue?.current;
            if (!track) {
              return await interaction.editReply({ 
                content: `**${client.emoji.cross} No song is currently playing.**`,
                flags: MessageFlags.Ephemeral
              }).catch(() => {});
            }

            try {
              const lyrics = await fetchLyrics(track.title, track.author);
              if (!lyrics) {
                return await interaction.editReply({ 
                  content: `**${client.emoji.cross} No lyrics found for \`${track.title}\` by \`${track.author}\`**`,
                  flags: MessageFlags.Ephemeral
                }).catch(() => {});
              }

              const pages = paginateLyrics(lyrics.lyrics, 15);
              const currentPage = 0;
              
              const headerDisplay = new TextDisplayBuilder()
                .setContent(`**${client.emoji.check} ${track.title}**`);

              const separator1 = new SeparatorBuilder();

              const lyricsDisplay = new TextDisplayBuilder()
                .setContent(pages[currentPage]);

              const separator2 = new SeparatorBuilder();

              const footerDisplay = new TextDisplayBuilder()
                .setContent(`**Page** \`:\` \`${currentPage + 1}/${pages.length}\` • **Source:** \`${lyrics.source}\``);

              const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("lyrics_prev")
                  .setLabel("Previous")
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(currentPage === 0),
                new ButtonBuilder()
                  .setCustomId("lyrics_next")
                  .setLabel("Next")
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(currentPage === pages.length - 1),
                new ButtonBuilder()
                  .setCustomId("lyrics_close")
                  .setLabel("Close")
                  .setStyle(ButtonStyle.Danger)
              );

              const separator3 = new SeparatorBuilder();

              const container = new ContainerBuilder()
                .addTextDisplayComponents(headerDisplay)
                .addSeparatorComponents(separator1)
                .addTextDisplayComponents(lyricsDisplay)
                .addSeparatorComponents(separator2)
                .addTextDisplayComponents(footerDisplay)
                .addSeparatorComponents(separator3)
                .addActionRowComponents(buttons);

              await interaction.editReply({ 
                components: [container], 
                flags: MessageFlags.IsComponentsV2 
              }).catch(() => {});

              const lyricsCollector = await interaction.editReply({ 
                components: [container], 
                flags: MessageFlags.IsComponentsV2 
              }).then(msg => msg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000,
              })).catch(() => null);

              if (!lyricsCollector) return;

              lyricsCollector.on("collect", async (btnInteraction) => {
                if (btnInteraction.user.id !== interaction.user.id) {
                  return btnInteraction.reply({ 
                    content: `**${client.emoji.cross} Only the command user can use these buttons.**`, 
                    flags: MessageFlags.Ephemeral
                  });
                }

                try {
                  await btnInteraction.deferUpdate();

                  let page = currentPage;
                  if (btnInteraction.customId === "lyrics_prev") page = Math.max(0, page - 1);
                  else if (btnInteraction.customId === "lyrics_next") page = Math.min(pages.length - 1, page + 1);
                  else if (btnInteraction.customId === "lyrics_close") {
                    lyricsCollector.stop();
                    return btnInteraction.deleteReply().catch(() => {});
                  }

                  const updatedDisplay = new TextDisplayBuilder()
                    .setContent(pages[page]);

                  const updatedFooter = new TextDisplayBuilder()
                    .setContent(`**Page** \`:\` \`${page + 1}/${pages.length}\` • **Source:** \`${lyrics.source}\``);

                  const updatedButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                      .setCustomId("lyrics_prev")
                      .setLabel("Previous")
                      .setStyle(ButtonStyle.Secondary)
                      .setDisabled(page === 0),
                    new ButtonBuilder()
                      .setCustomId("lyrics_next")
                      .setLabel("Next")
                      .setStyle(ButtonStyle.Secondary)
                      .setDisabled(page === pages.length - 1),
                    new ButtonBuilder()
                      .setCustomId("lyrics_close")
                      .setLabel("Close")
                      .setStyle(ButtonStyle.Danger)
                  );

                  const updatedContainer = new ContainerBuilder()
                    .addTextDisplayComponents(headerDisplay)
                    .addSeparatorComponents(separator1)
                    .addTextDisplayComponents(updatedDisplay)
                    .addSeparatorComponents(separator2)
                    .addTextDisplayComponents(updatedFooter)
                    .addSeparatorComponents(separator3)
                    .addActionRowComponents(updatedButtons);

                  await btnInteraction.editReply({ 
                    components: [updatedContainer], 
                    flags: MessageFlags.IsComponentsV2 
                  }).catch(() => {});
                } catch (error) {
                  console.error("Lyrics button error:", error);
                }
              });

              lyricsCollector.on("end", () => {
                const finalContainer = new ContainerBuilder()
                  .addTextDisplayComponents(headerDisplay)
                  .addSeparatorComponents(separator1)
                  .addTextDisplayComponents(lyricsDisplay)
                  .addSeparatorComponents(separator2)
                  .addTextDisplayComponents(footerDisplay);

                interaction.editReply({ components: [finalContainer] }).catch(() => {});
              });
            } catch (error) {
              console.error("Lyrics fetch error:", error);
              await interaction.editReply({ 
                content: `**${client.emoji.cross} Failed to fetch lyrics: ${error.message}**` 
              }).catch(() => {});
            }
            break;

          case "jump":
            const jumpModal = new ModalBuilder()
              .setCustomId("jump_modal")
              .setTitle("Jump to timestamp");

            const jumpInput = new TextInputBuilder()
              .setCustomId("jump_time")
              .setLabel("Enter time (e.g. 1:30, 90, 10s, 1m)")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("1:30")
              .setRequired(true);

            const jumpRow = new ActionRowBuilder().addComponents(jumpInput);
            jumpModal.addComponents(jumpRow);

            await interaction.showModal(jumpModal);
            break;

          case "queue_view":
            const queueCommand = client.slashCommands.get("queue") || client.commands.get("queue");
            if (queueCommand) {
              const queueWrapper = {
                guild: interaction.guild,
                channel: interaction.channel,
                author: interaction.user,
                reply: async (options) => {
                  if (interaction.replied || interaction.deferred) {
                    return await interaction.editReply(options);
                  } else {
                    return await interaction.reply(options);
                  }
                },
              };
              await queueCommand.execute(queueWrapper, [], client, prefix);
            }
            break;

          case "queue_shuffle":
            if (player.queue.length > 1) {
              await player.queue.shuffle();
              await interaction.reply({ 
                content: `**${client.emoji.check} Queue shuffled**`, 
                ephemeral: true 
              }).catch(() => { });
            } else {
              await interaction.reply({ 
                content: `**${client.emoji.info} Not enough songs to shuffle**`, 
                ephemeral: true 
              }).catch(() => { });
            }
            break;

          case "queue_clear":
            const count = player.queue.length;
            player.queue.clear();
            await interaction.reply({ 
              content: `**${client.emoji.check} Cleared ${count} songs from queue**`, 
              ephemeral: true 
            }).catch(() => { });
            break;
        }
        return;
      }

      const data = await db3.findOne({ Guild: interaction.guildId });
      if (
        data &&
        interaction.channelId === data.Channel &&
        interaction.message.id === data.Message
      )
        return client.emit("playerButtons", interaction, data);
    }

    if (interaction.type === InteractionType.ModalSubmit) {
      if (interaction.customId === "jump_modal") {
        const player = client.manager.players.get(interaction.guildId);
        if (!player || !player.queue.current) {
          return interaction.reply({ 
            content: `**${client.emoji.cross} No song is currently playing.**`,
            flags: MessageFlags.Ephemeral
          });
        }

        const timeInput = interaction.fields.getTextInputValue("jump_time");
        let time;

        if (/^\d+$/.test(timeInput)) {
          time = parseInt(timeInput) * 1000;
        } else if (/^\d+:\d+$/.test(timeInput)) {
          const [minutes, seconds] = timeInput.split(':').map(Number);
          time = (minutes * 60 + seconds) * 1000;
        } else if (/^\d+:\d+:\d+$/.test(timeInput)) {
          const [hours, minutes, seconds] = timeInput.split(':').map(Number);
          time = (hours * 3600 + minutes * 60 + seconds) * 1000;
        } else {
          const ms = require("ms");
          time = ms(timeInput);
        }

        if (!time || isNaN(time)) {
          return interaction.reply({ 
            content: `**${client.emoji.warn} Invalid time format. Examples: \`40\`, \`1:30\`, \`10s\`, \`1m\`**`,
            flags: MessageFlags.Ephemeral
          });
        }

        const position = player.shoukaku.position;
        const duration = player.queue.current.length;
        const song = player.queue.current;

        if (time <= duration) {
          await player.shoukaku.seekTo(time);
          const action = time > position ? "Forward" : "Rewind";
          await interaction.reply({ 
            content: `**${client.emoji.check} ${action}** \`:\` [${song.title}](${song.uri})\n**Position** \`:\` \`${convertTime(time)} / ${convertTime(duration)}\``,
            flags: MessageFlags.Ephemeral
          });
        } else {
          await interaction.reply({ 
            content: `**${client.emoji.warn} Seek duration exceeds song duration**\n**Song duration** \`:\` \`${convertTime(duration)}\``,
            flags: MessageFlags.Ephemeral
          }          );
        }
      }
    }

    if (interaction.type === InteractionType.ModalSubmit) {
      if (interaction.customId.startsWith("eq_band_")) {
        const player = client.manager.players.get(interaction.guildId);
        if (!player || !player.queue.current) {
          return interaction.reply({ 
            content: `**${client.emoji.cross} No song is currently playing.**`,
            flags: MessageFlags.Ephemeral
          });
        }

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
          .setContent(`**${client.emoji.check} Band ${band} set to \`${gainValue}\`**`);

        const updatedContainer = new ContainerBuilder()
          .addTextDisplayComponents(updatedDisplay);

        await interaction.reply({
          components: [updatedContainer],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
        });
      }
    }
  },
};

async function fetchLyrics(title, artist) {
  const sources = [
    fetchFromLyricsFinder.bind({}),
    fetchFromLRCLib.bind({}),
    fetchFromGenius.bind({}),
  ];

  for (const source of sources) {
    try {
      const result = await source(title, artist);
      if (result && result.lyrics) {
        return result;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

async function fetchFromLyricsFinder(title, artist) {
  try {
    const lyrics = await lyricsFinder(artist, title);
    if (lyrics && lyrics.length > 0) {
      return { lyrics: lyrics, source: "Lyrics Finder" };
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function fetchFromLRCLib(title, artist) {
  try {
    const response = await axios.get(
      `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
      { timeout: 5000 }
    );

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        lyrics: result.plainLyrics || result.syncedLyrics,
        source: "LRClib",
      };
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function fetchFromGenius(title, artist) {
  try {
    const query = `${artist} ${title}`.trim();
    const response = await axios.get(
      `https://some-random-api.com/lyrics?title=${encodeURIComponent(query)}`,
      { timeout: 5000 }
    );

    if (response.data && response.data.lyrics) {
      return { lyrics: response.data.lyrics, source: "Some Random API" };
    }
  } catch (error) {
    return null;
  }
  return null;
}

function paginateLyrics(lyrics, linesPerPage = 15) {
  const lines = lyrics.split("\n").filter((line) => line.trim());
  const pages = [];

  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage).join("\n"));
  }

  return pages.length > 0 ? pages : [lyrics];
}
