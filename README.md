# Ramadan Discord Bot (Node.js)

Bot Discord untuk Ramadan dengan fitur:

- Reminder otomatis waktu **imsak** dan **maghrib** ke channel tertentu.
- Kultum otomatis sebelum maghrib berisi tafsir acak dari EQuran.
- Mention role tertentu saat reminder terkirim.
- Slash command:
  - `/jadwal-sholat [tanggal]`
  - `/buka`
  - `/imsak`
- Status bot dinamis: `Watching Menuju Maghrib ...`.

Data diambil dari EQuran API v2:

- Jadwal sholat: `https://equran.id/api/v2/shalat`
- Tafsir surat: `https://equran.id/api/v2/tafsir/{nomor}`

## Setup

1. Install dependency:

```bash
npm install
```

2. Salin env template:

```bash
cp .env.example .env
```

Di Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Isi `.env`.

4. Deploy slash commands:

```bash
npm run deploy
```

5. Jalankan bot:

```bash
npm run start
```

## Catatan

- Gunakan `DISCORD_GUILD_ID` saat development supaya update command cepat.
- Jika `DISCORD_GUILD_ID` kosong, command di-deploy global (propagasi bisa lebih lama).
- `RAMADAN_PROVINSI` dan `RAMADAN_KABKOTA` harus sesuai data EQuran.
- `KULTUM_BEFORE_MAGHRIB_MINUTES` untuk atur berapa menit sebelum maghrib kultum dikirim.
- `KULTUM_MAX_CHARS` untuk membatasi panjang teks tafsir di embed.
