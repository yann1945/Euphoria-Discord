const { AttachmentBuilder, MessageFlags } = require("discord.js");
const { addXP } = require("./levelSystem");
const { generateLevelNotif } = require("./levelNotifHtml");

const XP_INTERVAL_KEY = "voiceXPInterval";
const XP_PER_MINUTE = 10;
const LEVEL_NOTIF_FILE = "level-notif.png";

async function startVoiceXP(client, player) {
  if (!player.data) player.data = new Map();
  if (player.data.has(XP_INTERVAL_KEY)) return;

  const interval = setInterval(async () => {
    try {
      if (!player.playing || player.paused) return;

      const guild = client.guilds.cache.get(player.guildId);
      if (!guild) return;

      const botMember = guild.members.me;
      if (!botMember?.voice?.channel) return;

      const voiceChannel = botMember.voice.channel;
      const members = voiceChannel.members.filter(m => !m.user.bot && !m.voice.deaf && !m.voice.afk);

      for (const member of members.values()) {
        try {
          const result = await addXP(member.id, XP_PER_MINUTE);
          if (result.leveledUp) {
            let notifBuffer = null;
            try {
              notifBuffer = await generateLevelNotif({
                username: member.user.username,
                avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 256, forceStatic: true }),
                level: result.level,
              });
            } catch (notifError) {
              console.error("[Level] Failed to generate notification:", notifError.message);
            }

            const files = [];
            if (notifBuffer && Buffer.isBuffer(notifBuffer) && notifBuffer.length > 0) {
              files.push(new AttachmentBuilder(notifBuffer, { name: LEVEL_NOTIF_FILE }));
            }

            const content = `Congratulations <@${member.id}>, you got Level Up ${result.level}!`;

            const targets = [voiceChannel];
            if (player.textId && player.textId !== voiceChannel.id) {
              const textChannel = client.channels.cache.get(player.textId);
              if (textChannel) targets.push(textChannel);
            }

            for (const target of targets) {
              try {
                await target.send({
                  content,
                  files,
                  flags: MessageFlags.IsComponentsV2,
                });
              } catch (sendError) {
                console.error(`[Level] Failed to send notification to ${target.id}:`, sendError.message);
              }
            }
          }
        } catch (xpError) {
          console.error("[Level] Failed to add XP:", xpError.message);
        }
      }
    } catch (error) {
      console.error("[Level] Voice XP interval error:", error.message);
    }
  }, 60000);

  player.data.set(XP_INTERVAL_KEY, interval);
}

function stopVoiceXP(player) {
  const interval = player.data?.get(XP_INTERVAL_KEY);
  if (interval) {
    clearInterval(interval);
    player.data?.delete(XP_INTERVAL_KEY);
  }
}

module.exports = { startVoiceXP, stopVoiceXP };
