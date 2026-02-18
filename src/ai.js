import { config } from "./config.js";

const CHAT_PATHS = ["/v1/chat/completions", "/chat/completions"];

const RAMADAN_SYSTEM_PROMPT = [
  "Kamu adalah asisten Discord khusus Ramadan berbahasa Indonesia.",
  "Fokus utama: puasa Ramadan, jadwal ibadah, niat, adab, motivasi, dan amalan harian.",
  "Jawaban ringkas, jelas, sopan, dan praktis.",
  "Format jawaban rapi: gunakan paragraf pendek dan bullet jika ada beberapa poin; jangan satu baris panjang.",
  "Jika pertanyaan di luar Ramadan atau ibadah, arahkan kembali secara halus ke konteks Ramadan.",
  "Jika menyebut dalil, hindari mengarang; jika tidak yakin, katakan tidak yakin.",
  "Jangan memberi fatwa pasti; sarankan cek ustaz/ulama setempat untuk keputusan fikih detail."
].join(" ");

function buildUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function shouldTryNextPath(status, bodyText) {
  if ([404, 405, 501].includes(status)) return true;
  const text = String(bodyText || "").toLowerCase();
  return (
    text.includes("unknown request url") ||
    text.includes("not found") ||
    text.includes("no route")
  );
}

function makeApiError(message, extras = {}) {
  const error = new Error(message);
  Object.assign(error, extras);
  return error;
}

async function postChatCompletion({ messages }) {
  const payload = {
    model: config.aiModel,
    messages,
    stream: false,
    max_tokens: config.aiMaxTokens,
    temperature: config.aiTemperature
  };

  let lastError = null;
  for (const path of CHAT_PATHS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.aiTimeoutMs);

    try {
      const response = await fetch(buildUrl(config.aiBaseUrl, path), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.aiApiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const text = await response.text();
      if (!response.ok) {
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
        const apiCode = parsed?.error?.code || null;
        const apiType = parsed?.error?.type || null;
        const apiMessage = parsed?.error?.message || text;

        if (shouldTryNextPath(response.status, text)) {
          lastError = makeApiError(`AI endpoint ${path} gagal (${response.status}).`, {
            status: response.status,
            apiCode,
            apiType,
            apiMessage
          });
          continue;
        }
        throw makeApiError(`AI request gagal (${response.status}): ${apiMessage}`, {
          status: response.status,
          apiCode,
          apiType,
          apiMessage
        });
      }

      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error("Semua endpoint AI gagal diakses.");
}

function sanitizeInlineText(prompt) {
  return String(prompt || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAssistantText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function askRamadanAssistant(rawPrompt) {
  const prompt = sanitizeInlineText(rawPrompt);
  if (!prompt) {
    throw new Error("Prompt kosong.");
  }

  const json = await postChatCompletion({
    messages: [
      { role: "system", content: RAMADAN_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ]
  });

  const content = json?.choices?.[0]?.message?.content;
  const answer = normalizeAssistantText(content);
  if (!answer) {
    throw new Error("AI tidak mengembalikan jawaban.");
  }

  return answer;
}

export async function askRamadanAssistantWithContext(rawPrompt, rawContext) {
  const prompt = sanitizeInlineText(rawPrompt);
  const context = sanitizeInlineText(rawContext);
  if (!prompt) {
    throw new Error("Prompt kosong.");
  }

  const json = await postChatCompletion({
    messages: [
      { role: "system", content: RAMADAN_SYSTEM_PROMPT },
      context
        ? {
            role: "system",
            content:
              "Data jadwal berikut adalah sumber utama untuk jam sholat/imsak/maghrib. Gunakan data ini sebagai rujukan utama dan jangan menebak jam. " +
              context
          }
        : null,
      { role: "user", content: prompt }
    ].filter(Boolean)
  });

  const content = json?.choices?.[0]?.message?.content;
  const answer = normalizeAssistantText(content);
  if (!answer) {
    throw new Error("AI tidak mengembalikan jawaban.");
  }

  return answer;
}
