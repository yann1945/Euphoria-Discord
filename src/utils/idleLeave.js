const { TextDisplayBuilder, ContainerBuilder, MessageFlags } = require("discord.js");

const IDLE_LEAVE_KEY = "idleLeaveTimeout";
const IDLE_LEAVE_DELAY = 2 * 60 * 1000; // 2 minutes

function startIdleLeaveTimer(player, client) {
  if (!player.data) player.data = new Map();
  if (player.data.has(IDLE_LEAVE_KEY)) {
    clearTimeout(player.data.get(IDLE_LEAVE_KEY));
  }

  const timeout = setTimeout(async () => {
    try {
      const guildId = player.guildId;
      const activePlayer = client.manager?.players?.get(guildId);
      if (!activePlayer || activePlayer !== player) return;

      const hasTrack = activePlayer.queue?.current || activePlayer.playing;
      if (hasTrack) return;

      const textChannel = client.channels.cache.get(player.textId);
      if (textChannel) {
        const display = new TextDisplayBuilder()
          .setContent(`**${client.emoji.info} No tracks in queue — leaving voice channel in 2 minutes.**`);

        const container = new ContainerBuilder()
          .addTextDisplayComponents(display);

        textChannel
          .send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
          })
          .then((msg) =>
            setTimeout(() => msg.delete().catch(() => null), 5000)
          )
          .catch(() => null);
      }

      await safeDestroyPlayer(client, player);
    } catch (error) {
      console.error("[IdleLeave] Error:", error.message);
    }
  }, IDLE_LEAVE_DELAY);

  player.data.set(IDLE_LEAVE_KEY, timeout);
}

function cancelIdleLeaveTimer(player) {
  const timeout = player.data?.get(IDLE_LEAVE_KEY);
  if (timeout) {
    clearTimeout(timeout);
    player.data?.delete(IDLE_LEAVE_KEY);
  }
}

async function safeDestroyPlayer(client, player) {
  try {
    await player.destroy();
  } catch (destroyError) {
    if (client.manager?.players?.has(player.guildId)) {
      client.manager.players.delete(player.guildId);
    }
  }
}

module.exports = { startIdleLeaveTimer, cancelIdleLeaveTimer, IDLE_LEAVE_DELAY };
