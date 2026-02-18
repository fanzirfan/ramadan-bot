function getTzParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
    second: Number(byType.second)
  };
}

function getOffsetMs(date, timeZone) {
  const p = getTzParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

export function getDateKeyInTimeZone(date, timeZone) {
  const p = getTzParts(date, timeZone);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
}

export function parseDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function dateFromDateKey(dateKey) {
  const p = parseDateKey(dateKey);
  if (!p) return null;
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0));
}

export function addDaysToDateKey(dateKey, days) {
  const base = dateFromDateKey(dateKey);
  if (!base) return null;
  base.setUTCDate(base.getUTCDate() + days);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toDateTimeInTimeZone(dateKey, hhmm, timeZone) {
  const p = parseDateKey(dateKey);
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm || "");
  if (!p || !match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const utcGuess = Date.UTC(p.year, p.month - 1, p.day, hour, minute, 0);
  const guessedDate = new Date(utcGuess);
  const offset = getOffsetMs(guessedDate, timeZone);
  return new Date(utcGuess - offset);
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) return `${hours} jam ${minutes} menit`;
  if (minutes > 0) return `${minutes} menit ${seconds} detik`;
  return `${seconds} detik`;
}

function diffDaysBetweenDateKeys(startDateKey, currentDateKey) {
  const start = parseDateKey(startDateKey);
  const current = parseDateKey(currentDateKey);
  if (!start || !current) return null;

  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const currentUtc = Date.UTC(current.year, current.month - 1, current.day);
  return Math.floor((currentUtc - startUtc) / 86_400_000);
}

export function getRamadanDayInTimeZone(date, timeZone, ramadanStartDateKey, ramadanTotalDays = 30) {
  const currentDateKey = getDateKeyInTimeZone(date, timeZone);
  const diff = diffDaysBetweenDateKeys(ramadanStartDateKey, currentDateKey);
  if (diff === null) return null;

  const day = diff + 1;
  if (day < 1 || day > ramadanTotalDays) return null;
  return day;
}

export function getRamadanDayFromDateKey(dateKey, ramadanStartDateKey, ramadanTotalDays = 30) {
  const diff = diffDaysBetweenDateKeys(ramadanStartDateKey, dateKey);
  if (diff === null) return null;

  const day = diff + 1;
  if (day < 1 || day > ramadanTotalDays) return null;
  return day;
}
