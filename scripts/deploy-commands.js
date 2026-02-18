import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commandJson } from "../src/commands.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  throw new Error("DISCORD_TOKEN dan DISCORD_CLIENT_ID wajib diisi.");
}

const rest = new REST({ version: "10" }).setToken(token);

if (guildId) {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commandJson
  });
  console.log(`Slash command sukses deploy ke guild ${guildId}.`);
} else {
  await rest.put(Routes.applicationCommands(clientId), {
    body: commandJson
  });
  console.log("Slash command sukses deploy global.");
}
