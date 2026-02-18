import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable wajib: ${name}`);
  }
  return value;
}

function optionalNumber(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  discordToken: required("DISCORD_TOKEN"),
  discordClientId: required("DISCORD_CLIENT_ID"),
  discordGuildId: process.env.DISCORD_GUILD_ID,
  channelId: required("DISCORD_CHANNEL_ID"),
  roleId: process.env.DISCORD_ROLE_ID,
  provinsi: required("RAMADAN_PROVINSI"),
  kabkota: required("RAMADAN_KABKOTA"),
  timezone: process.env.TIMEZONE || "Asia/Jakarta",
  statusRefreshMs: optionalNumber("STATUS_REFRESH_MS", 60_000),
  checkIntervalMs: optionalNumber("CHECK_INTERVAL_MS", 30_000),
  kultumBeforeMaghribMinutes: optionalNumber("KULTUM_BEFORE_MAGHRIB_MINUTES", 20),
  kultumMaxChars: optionalNumber("KULTUM_MAX_CHARS", 500)
};
