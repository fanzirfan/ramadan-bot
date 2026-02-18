import {
  ActivityType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits
} from "discord.js";
import { config } from "./config.js";
import { getDailyShalat, getRandomTafsirSnippet } from "./equran.js";
import {
  addDaysToDateKey,
  dateFromDateKey,
  formatCountdown,
  getDateKeyInTimeZone,
  toDateTimeInTimeZone
} from "./time.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const sentReminderSet = new Set();
const sentKultumSet = new Set();
const presenceState = {
  lastText: "",
  lastType: null,
  lastUpdateMs: 0
};

const WARM_LINES = [
  "Niat baik, puasa berkah",
  "Jaga lisan, jaga hati",
  "Cukup minum setelah buka",
  "Semoga puasamu lancar",
  "Tetap tenang, tetap ibadah",
  "Jangan lupa doa terbaik"
];

function roleMention() {
  return config.roleId ? `<@&${config.roleId}>` : "";
}

function buildDailyEmbed(schedule, title) {
  return new EmbedBuilder()
    .setColor(0x2d8f58)
    .setTitle(title)
    .setDescription(
      `${schedule.kabkota}, ${schedule.provinsi}\nTanggal: ${schedule.dateKey}${
        schedule.dayName ? ` (${schedule.dayName})` : ""
      }`
    )
    .addFields(
      { name: "Imsak", value: schedule.imsak, inline: true },
      { name: "Subuh", value: schedule.subuh, inline: true },
      { name: "Terbit", value: schedule.terbit, inline: true },
      { name: "Dhuha", value: schedule.dhuha, inline: true },
      { name: "Dzuhur", value: schedule.dzuhur, inline: true },
      { name: "Ashar", value: schedule.ashar, inline: true },
      { name: "Maghrib", value: schedule.maghrib, inline: true },
      { name: "Isya", value: schedule.isya, inline: true }
    )
    .setTimestamp(new Date());
}

function buildCountdownEmbed({ label, schedule, eventTime, dateKey, now }) {
  const diff = eventTime.getTime() - now.getTime();
  const target = label === "maghrib" ? schedule.maghrib : schedule.imsak;
  const isFuture = diff > 0;

  return new EmbedBuilder()
    .setColor(label === "maghrib" ? 0xf59e0b : 0x38bdf8)
    .setTitle(label === "maghrib" ? "Countdown Buka" : "Countdown Imsak")
    .setDescription(
      `${schedule.kabkota}, ${schedule.provinsi}\n` +
        `${label === "maghrib" ? "Maghrib" : "Imsak"}: ${target} (${dateKey})\n` +
        (isFuture
          ? `Sisa waktu: **${formatCountdown(diff)}**`
          : "Waktu sudah lewat.")
    )
    .setTimestamp(new Date());
}

function buildKultumEmbed({ snippet, schedule, dateKey, minutesLeft }) {
  const sisaWaktuText =
    minutesLeft > 0 ? `${minutesLeft} menit lagi` : "Siap dibaca kapan saja";

  return new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle("Kultum Menjelang Berbuka")
    .setDescription(snippet.text)
    .addFields(
      {
        name: "Tafsir",
        value: `${snippet.surahName} (${snippet.surahNumber}:${snippet.ayah})`,
        inline: false
      },
      {
        name: "Maghrib",
        value: `${schedule.maghrib} (${dateKey})`,
        inline: true
      },
      {
        name: "Sisa Waktu",
        value: sisaWaktuText,
        inline: true
      }
    )
    .setFooter({ text: `${schedule.kabkota}, ${schedule.provinsi}` })
    .setTimestamp(new Date());
}

function parseDateOption(raw) {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = dateFromDateKey(raw);
  return d ? raw : null;
}

async function getScheduleByDateKey(dateKey) {
  return getDailyShalat({
    provinsi: config.provinsi,
    kabkota: config.kabkota,
    dateKey
  });
}

async function getNextEvent(eventName, now) {
  const todayKey = getDateKeyInTimeZone(now, config.timezone);
  const todaySchedule = await getScheduleByDateKey(todayKey);
  const todayTime = toDateTimeInTimeZone(todayKey, todaySchedule[eventName], config.timezone);

  if (todayTime && todayTime.getTime() > now.getTime()) {
    return {
      eventName,
      dateKey: todayKey,
      schedule: todaySchedule,
      eventTime: todayTime
    };
  }

  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const tomorrowSchedule = await getScheduleByDateKey(tomorrowKey);
  const tomorrowTime = toDateTimeInTimeZone(
    tomorrowKey,
    tomorrowSchedule[eventName],
    config.timezone
  );

  return {
    eventName,
    dateKey: tomorrowKey,
    schedule: tomorrowSchedule,
    eventTime: tomorrowTime
  };
}

async function updateDynamicPresence() {
  if (!client.user) return;

  const now = new Date();
  const nextImsak = await getNextEvent("imsak", now);
  const nextMaghrib = await getNextEvent("maghrib", now);

  const nearest =
    nextImsak.eventTime.getTime() <= nextMaghrib.eventTime.getTime()
      ? nextImsak
      : nextMaghrib;

  const remainingMs = nearest.eventTime.getTime() - now.getTime();
  const remainingMinutes = Math.max(0, Math.floor(remainingMs / 60_000));
  const label = nearest.eventName === "maghrib" ? "maghrib" : "imsak";
  const labelDisplay = label.charAt(0).toUpperCase() + label.slice(1);

  const minuteGate = now.getUTCMinutes() % 4;
  const countdownPriority =
    remainingMinutes <= 90
      ? minuteGate !== 3
      : remainingMinutes <= 240
        ? minuteGate % 2 === 0
        : minuteGate === 0;

  const countdownStep = remainingMinutes <= 30 ? 2 : 5;
  const onCountdownBoundary = remainingMinutes <= 2 || remainingMinutes % countdownStep === 0;

  let text;
  let type;

  if (countdownPriority && onCountdownBoundary) {
    if (remainingMinutes >= 60) {
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = String(remainingMinutes % 60).padStart(2, "0");
      text = `Menuju ${labelDisplay} ${hours}j ${minutes}m`;
    } else {
      text = `${labelDisplay} ${remainingMinutes}m lagi`;
    }
    type = ActivityType.Watching;
  } else {
    const warmIndex =
      (Math.floor(now.getTime() / 60_000) + (label === "imsak" ? 1 : 0)) % WARM_LINES.length;
    text = WARM_LINES[warmIndex];
    type = ActivityType.Listening;
  }

  const nowMs = now.getTime();
  const minUpdateMs = Math.max(config.statusRefreshMs, 120_000);
  if (
    presenceState.lastText === text &&
    presenceState.lastType === type &&
    nowMs - presenceState.lastUpdateMs < minUpdateMs
  ) {
    return;
  }

  await client.user.setPresence({
    activities: [{ name: text, type }],
    status: "online"
  });

  presenceState.lastText = text;
  presenceState.lastType = type;
  presenceState.lastUpdateMs = nowMs;
}

async function sendAutoReminders() {
  const now = new Date();
  const dateKey = getDateKeyInTimeZone(now, config.timezone);
  const schedule = await getScheduleByDateKey(dateKey);

  const channel = await client.channels.fetch(config.channelId);
  if (!channel?.isTextBased()) {
    throw new Error("Target channel tidak valid atau bukan text channel.");
  }

  const targets = [
    { key: "imsak", label: "Imsak", time: schedule.imsak },
    { key: "maghrib", label: "Maghrib", time: schedule.maghrib }
  ];

  for (const target of targets) {
    const eventTime = toDateTimeInTimeZone(dateKey, target.time, config.timezone);
    if (!eventTime) continue;

    const diff = eventTime.getTime() - now.getTime();
    const marker = `${dateKey}:${target.key}`;
    const inWindow = diff <= config.checkIntervalMs && diff >= -59_000;

    if (!inWindow || sentReminderSet.has(marker)) {
      continue;
    }

    const content = `${roleMention()} ${target.label} untuk ${schedule.kabkota} sudah masuk (${target.time}).`;
    await channel.send({
      content,
      allowedMentions: config.roleId ? { roles: [config.roleId] } : { parse: [] }
    });

    sentReminderSet.add(marker);
  }

  const maghribTime = toDateTimeInTimeZone(dateKey, schedule.maghrib, config.timezone);
  if (maghribTime) {
    const diffMs = maghribTime.getTime() - now.getTime();
    const beforeMs = config.kultumBeforeMaghribMinutes * 60_000;
    const marker = `${dateKey}:kultum-maghrib`;
    const inWindow = diffMs <= beforeMs && diffMs > beforeMs - config.checkIntervalMs;

    if (inWindow && !sentKultumSet.has(marker)) {
      const snippet = await getRandomTafsirSnippet({ maxLength: config.kultumMaxChars });
      const minutesLeft = Math.max(1, Math.ceil(diffMs / 60_000));

      await channel.send({
        content: `${roleMention()} Kultum singkat sebelum berbuka.`,
        embeds: [buildKultumEmbed({ snippet, schedule, dateKey, minutesLeft })],
        allowedMentions: config.roleId ? { roles: [config.roleId] } : { parse: [] }
      });

      sentKultumSet.add(marker);
    }
  }

  if (sentReminderSet.size > 200) {
    sentReminderSet.clear();
  }

  if (sentKultumSet.size > 200) {
    sentKultumSet.clear();
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot login sebagai ${readyClient.user.tag}`);

  try {
    await updateDynamicPresence();
    await sendAutoReminders();
  } catch (error) {
    console.error("Inisialisasi awal gagal:", error);
  }

  setInterval(async () => {
    try {
      await updateDynamicPresence();
    } catch (error) {
      console.error("Gagal update status:", error);
    }
  }, config.statusRefreshMs).unref();

  setInterval(async () => {
    try {
      await sendAutoReminders();
    } catch (error) {
      console.error("Gagal kirim reminder otomatis:", error);
    }
  }, config.checkIntervalMs).unref();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "jadwal-sholat") {
      const dateInput = interaction.options.getString("tanggal");
      const parsed = parseDateOption(dateInput);
      if (dateInput && !parsed) {
        await interaction.reply({
          content: "Format tanggal tidak valid. Gunakan YYYY-MM-DD.",
          ephemeral: true
        });
        return;
      }

      const dateKey = parsed || getDateKeyInTimeZone(new Date(), config.timezone);
      const schedule = await getScheduleByDateKey(dateKey);
      await interaction.reply({
        embeds: [buildDailyEmbed(schedule, "Jadwal Sholat")]
      });
      return;
    }

    if (interaction.commandName === "buka" || interaction.commandName === "imsak") {
      const eventName = interaction.commandName === "buka" ? "maghrib" : "imsak";
      const nextEvent = await getNextEvent(eventName, new Date());

      await interaction.reply({
        embeds: [
          buildCountdownEmbed({
            label: eventName,
            schedule: nextEvent.schedule,
            eventTime: nextEvent.eventTime,
            dateKey: nextEvent.dateKey,
            now: new Date()
          })
        ]
      });
      return;
    }

    if (interaction.commandName === "kultum") {
      const now = new Date();
      const dateKey = getDateKeyInTimeZone(now, config.timezone);
      const schedule = await getScheduleByDateKey(dateKey);
      const snippet = await getRandomTafsirSnippet({ maxLength: config.kultumMaxChars });

      await interaction.reply({
        embeds: [
          buildKultumEmbed({
            snippet,
            schedule,
            dateKey,
            minutesLeft: 0
          })
        ]
      });
      return;
    }
  } catch (error) {
    console.error("Command error:", error);
    const message = "Terjadi error saat mengambil jadwal. Coba lagi sebentar.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  }
});

client.login(config.discordToken);
