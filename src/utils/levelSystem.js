const Level = require("../schema/level");

const BASE_XP = 100;
const XP_PER_MINUTE = 10;

function calculateRequiredXP(level) {
  return BASE_XP * level * level;
}

async function addXP(userId, xp) {
  const data = await Level.findOneAndUpdate(
    { userId },
    { $inc: { xp } },
    { returnDocument: 'after', upsert: true }
  );

  let leveledUp = false;
  while (data.xp >= calculateRequiredXP(data.level)) {
    data.xp -= calculateRequiredXP(data.level);
    data.level += 1;
    leveledUp = true;
  }

  if (leveledUp) {
    await data.save();
  }

  return { xp: data.xp, level: data.level, leveledUp };
}

async function getLevel(userId) {
  const data = await Level.findOne({ userId });
  if (!data) return { xp: 0, level: 1 };
  return { xp: data.xp, level: data.level };
}

module.exports = { addXP, getLevel, calculateRequiredXP, XP_PER_MINUTE };
