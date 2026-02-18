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
  kultumMaxChars: optionalNumber("KULTUM_MAX_CHARS", 500),
  aiApiKey: process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || "",
  aiBaseUrl: process.env.AI_BASE_URL || "https://ai.sumopod.com",
  aiModel: process.env.AI_MODEL || "deepseek-v3-2-free",
  aiMaxTokens: optionalNumber("AI_MAX_TOKENS", 700),
  aiTemperature: optionalNumber("AI_TEMPERATURE", 0.7),
  aiTimeoutMs: optionalNumber("AI_TIMEOUT_MS", 45_000),
  aiCooldownMs: optionalNumber("AI_COOLDOWN_MS", 12_000),
  aiMaxPromptChars: optionalNumber("AI_MAX_PROMPT_CHARS", 700),
  ramadanStartDate: process.env.RAMADAN_START_DATE || "2026-02-19",
  ramadanTotalDays: optionalNumber("RAMADAN_TOTAL_DAYS", 30)
};
