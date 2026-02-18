const BASE_URL = "https://equran.id/api/v2";
const LIST_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 400;

const monthlyCache = new Map();
let suratListCache = null;
let suratListCacheAt = 0;

async function postJson(path, body) {
  return requestJson(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function getJson(path) {
  return requestJson(path);
}

function isTransientStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(path, options = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        const err = new Error(`EQuran API gagal (${response.status}): ${text}`);
        if (isTransientStatus(response.status) && attempt < MAX_RETRIES) {
          lastError = err;
          const backoff = BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 250);
          await wait(backoff);
          continue;
        }
        throw err;
      }

      const json = await response.json();
      if (json?.code && json.code !== 200) {
        throw new Error(`EQuran API error: ${json.message || "unknown"}`);
      }

      return json;
    } catch (error) {
      const message = String(error?.message || "");
      const isAbort = error?.name === "AbortError" || message.includes("aborted");
      const isNetwork =
        message.includes("fetch failed") ||
        message.includes("network") ||
        message.includes("ECONNRESET") ||
        message.includes("ENOTFOUND") ||
        isAbort;

      if (isNetwork && attempt < MAX_RETRIES) {
        lastError = error;
        const backoff = BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 250);
        await wait(backoff);
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error("EQuran request gagal setelah retry.");
}

function toPlainText(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function pickRandomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function getSuratList() {
  const now = Date.now();
  if (suratListCache && now - suratListCacheAt < LIST_CACHE_TTL_MS) {
    return suratListCache;
  }

  const json = await getJson("/surat");
  const list = Array.isArray(json?.data) ? json.data : [];
  if (list.length === 0) {
    throw new Error("Daftar surat tidak ditemukan dari EQuran.");
  }

  suratListCache = list;
  suratListCacheAt = now;
  return list;
}

export async function getMonthlyShalat({ provinsi, kabkota, month, year }) {
  const key = `${provinsi}|${kabkota}|${year}-${month}`;
  if (monthlyCache.has(key)) return monthlyCache.get(key);

  const json = await postJson("/shalat", {
    provinsi,
    kabkota,
    bulan: month,
    tahun: year
  });

  const jadwal = json?.data?.jadwal;
  if (!Array.isArray(jadwal)) {
    throw new Error("Format data jadwal shalat tidak valid.");
  }

  monthlyCache.set(key, json.data);
  return json.data;
}

export async function getDailyShalat({ provinsi, kabkota, dateKey }) {
  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const month = Number(monthStr);
  const year = Number(yearStr);
  const day = Number(dayStr);

  const monthly = await getMonthlyShalat({ provinsi, kabkota, month, year });
  const daily = monthly.jadwal.find(
    (item) => item.tanggal_lengkap === dateKey || Number(item.tanggal) === day
  );

  if (!daily) {
    throw new Error(`Jadwal tanggal ${dateKey} tidak ditemukan.`);
  }

  return {
    dateKey,
    provinsi: monthly.provinsi,
    kabkota: monthly.kabkota,
    dayName: daily.hari,
    imsak: daily.imsak,
    subuh: daily.subuh,
    terbit: daily.terbit,
    dhuha: daily.dhuha,
    dzuhur: daily.dzuhur,
    ashar: daily.ashar,
    maghrib: daily.maghrib,
    isya: daily.isya
  };
}

export async function getRandomTafsirSnippet({ maxLength = 500, maxAttempts = 7 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const nomorSurah = Math.floor(Math.random() * 114) + 1;
    const json = await getJson(`/tafsir/${nomorSurah}`);
    const data = json?.data;
    const list = Array.isArray(data?.tafsir) ? data.tafsir : [];

    if (!data || list.length === 0) {
      continue;
    }

    const picked = list[Math.floor(Math.random() * list.length)];
    const plain = toPlainText(picked?.teks);
    if (!plain) {
      continue;
    }

    return {
      surahNumber: data.nomor,
      surahName: data.namaLatin || data.nama || `Surah ${data.nomor}`,
      ayah: picked.ayat,
      text: truncateText(plain, maxLength)
    };
  }

  throw new Error("Tidak bisa mengambil tafsir acak dari EQuran.");
}

export async function getRandomAyat({ maxLength = 500, maxAttempts = 7 } = {}) {
  const suratList = await getSuratList();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const pickedSurat = pickRandomItem(suratList);
    const json = await getJson(`/surat/${pickedSurat.nomor}`);
    const data = json?.data;
    const ayatList = Array.isArray(data?.ayat) ? data.ayat : [];

    if (!data || ayatList.length === 0) {
      continue;
    }

    const ayat = pickRandomItem(ayatList);
    const arab = String(ayat?.teksArab || "").trim();
    const latin = toPlainText(ayat?.teksLatin);
    const translation = toPlainText(ayat?.teksIndonesia);

    if (!arab || !translation) {
      continue;
    }

    return {
      surahNumber: data.nomor,
      surahName: data.namaLatin || data.nama || `Surah ${data.nomor}`,
      surahNameArabic: data.nama || "",
      ayah: ayat.nomorAyat,
      arab,
      latin: truncateText(latin, maxLength),
      translation: truncateText(translation, maxLength)
    };
  }

  throw new Error("Tidak bisa mengambil ayat acak dari EQuran.");
}
