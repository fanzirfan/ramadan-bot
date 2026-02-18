import { SlashCommandBuilder } from "discord.js";

export const commandBuilders = [
  new SlashCommandBuilder()
    .setName("jadwal-sholat")
    .setDescription("Lihat jadwal sholat berdasarkan tanggal")
    .addStringOption((option) =>
      option
        .setName("tanggal")
        .setDescription("Format YYYY-MM-DD (opsional, default hari ini)")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("buka")
    .setDescription("Lihat countdown menuju maghrib (buka puasa)"),

  new SlashCommandBuilder()
    .setName("imsak")
    .setDescription("Lihat countdown menuju imsak"),

  new SlashCommandBuilder()
    .setName("kultum")
    .setDescription("Kirim kultum tafsir acak dari EQuran")
];

export const commandJson = commandBuilders.map((builder) => builder.toJSON());
