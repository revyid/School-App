// Server-side TTS Piper (suara Indonesia rhasspy/piper-voices id_ID/news_tts/medium).
// Binary + espeak data dibundel di apps/web/vendor/piper (tanpa model 61M);
// model ONNX diunduh sekali dari HuggingFace ke dir cache lalu dipakai ulang.
// Audio hasil sintesis di-cache per hash teks agar scan berulang instan.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, createWriteStream } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

const HF_BASE =
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/id/id_ID/news_tts/medium";
const MODEL_FILE = "id_ID-news_tts-medium.onnx";
const MODEL_JSON = `${MODEL_FILE}.json`;

const MAX_TEXT = 200;
const SYNTH_TIMEOUT_MS = 20_000;

const inflight = new Map<string, Promise<Buffer>>();

export function vendorDir(): string {
  return path.join(process.cwd(), "vendor", "piper");
}

export function cacheDir(): string {
  return process.env.PIPER_CACHE_DIR ?? path.join(os.homedir(), ".cache", "sms-tts");
}

function modelPath(): string {
  return path.join(cacheDir(), "models", MODEL_FILE);
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`unduh model gagal (${res.status})`);
  await mkdir(path.dirname(dest), { recursive: true });
  await finished(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream).pipe(createWriteStream(dest)));
}

async function ensureModel(): Promise<void> {
  const dir = path.join(cacheDir(), "models");
  await mkdir(dir, { recursive: true });
  const onnx = path.join(dir, MODEL_FILE);
  const json = path.join(dir, MODEL_JSON);
  try {
    await access(onnx, constants.R_OK);
    await access(json, constants.R_OK);
    return;
  } catch {
    // belum ada — unduh
  }
  await downloadFile(`${HF_BASE}/${MODEL_FILE}`, onnx);
  await downloadFile(`${HF_BASE}/${MODEL_JSON}`, json);
}

function runPiper(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bin = path.join(vendorDir(), "piper");
    const child = spawn(bin, ["--model", modelPath(), "--output_file", "-"], {
      env: { ...process.env, LD_LIBRARY_PATH: vendorDir() },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("piper timeout"));
    }, SYNTH_TIMEOUT_MS);
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`piper exit ${code}: ${stderr.slice(-300)}`));
    });
    child.stdin.write(text);
    child.stdin.end();
  });
}

export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
}

export async function synthesize(text: string): Promise<Buffer> {
  const clean = cleanText(text);
  if (!clean) throw new Error("teks kosong");
  const key = createHash("sha256").update(clean).digest("hex");
  const cached = path.join(cacheDir(), "audio", `${key}.wav`);
  try {
    await access(cached, constants.R_OK);
    return await readFile(cached);
  } catch {
    // belum di-cache
  }
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    await ensureModel();
    const wav = await runPiper(clean);
    await mkdir(path.dirname(cached), { recursive: true });
    await writeFile(cached, wav).catch(() => {});
    return wav;
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}
