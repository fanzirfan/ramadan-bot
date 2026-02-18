const BASE_URL = "https://equran.id/api/v2";

const monthlyCache = new Map();

async function postJson(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EQuran API gagal (${response.status}): ${text}`);
  }

  const json = await response.json();
  if (json?.code && json.code !== 200) {
    throw new Error(`EQuran API error: ${json.message || "unknown"}`);
  }

  return json;
}

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EQuran API gagal (${response.status}): ${text}`);
  }

  const json = await response.json();
  if (json?.code && json.code !== 200) {
    throw new Error(`EQuran API error: ${json.message || "unknown"}`);
  }

  return json;
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
