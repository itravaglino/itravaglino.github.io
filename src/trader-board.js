/** Leaderboard client. Remote Supabase when the public env vars exist; otherwise this browser. */

import { SCORE } from "./trader-score.js";

const LOCAL_KEY = "it-trader-board";
const CLIENT_KEY = "it-trader-client";

const BLOCKED = ["fuck", "shit", "bitch", "asshole", "nigger", "faggot", "cunt", "puta", "mierda", "cabron", "cabrón"];

export function boardEnv() {
  const url = (import.meta.env?.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = (import.meta.env?.VITE_SUPABASE_ANON_KEY || "").trim();
  return { url, key, remote: Boolean(url && key) };
}

export function sanitizeName(raw) {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 20) return { ok: false, error: "length" };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'’-]{0,19}$/u.test(name)) return { ok: false, error: "charset" };
  const folded = name.toLowerCase();
  const tokens = folded.split(/[^a-z0-9áéíóúüñ]+/i).filter(Boolean);
  if (BLOCKED.some((word) => tokens.includes(word) || folded.includes(word))) return { ok: false, error: "name" };
  return { ok: true, name };
}

export function scoreInBounds(mode, score) {
  if (!Number.isInteger(score)) return false;
  if (mode === "daily") return score >= SCORE.dailyMin && score <= SCORE.dailyMax;
  if (mode === "portfolio") return score >= SCORE.portfolioMin && score <= SCORE.portfolioMax;
  return false;
}

export function qualify(score, rows) {
  const top = [...rows].sort((a, b) => b.score - a.score || String(a.created_at).localeCompare(String(b.created_at))).slice(0, 10);
  if (top.length < 10) return true;
  return score > top[9].score;
}

export function clientFingerprint() {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id.slice(0, 32);
  } catch {
    return "localclient00000000000000000000";
  }
}

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || { daily: {}, portfolio: [] };
  } catch {
    return { daily: {}, portfolio: [] };
  }
}

function writeLocal(data) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    /* private mode */
  }
}

export function localTop(mode, day) {
  const data = readLocal();
  const rows = mode === "daily" ? data.daily?.[day] || [] : data.portfolio || [];
  return [...rows].sort((a, b) => b.score - a.score || String(a.created_at).localeCompare(String(b.created_at))).slice(0, 10);
}

export function localSubmit({ mode, day, name, score }) {
  const cleaned = sanitizeName(name);
  if (!cleaned.ok) return { ok: false, error: cleaned.error };
  if (!scoreInBounds(mode, score)) return { ok: false, error: "score" };
  const data = readLocal();
  const created_at = new Date().toISOString();
  if (mode === "daily") {
    data.daily = data.daily || {};
    const rows = data.daily[day] || [];
    if (rows.some((row) => row.fingerprint === clientFingerprint())) return { ok: false, error: "rate" };
    if (!qualify(score, rows)) return { ok: false, error: "not_top10" };
    rows.push({ name: cleaned.name, score, created_at, fingerprint: clientFingerprint() });
    data.daily[day] = rows;
  } else if (mode === "portfolio") {
    data.portfolio = data.portfolio || [];
    const todayRows = data.portfolio.filter((row) => row.day === day && row.fingerprint === clientFingerprint());
    if (todayRows.length) return { ok: false, error: "rate" };
    if (!qualify(score, data.portfolio)) return { ok: false, error: "not_top10" };
    data.portfolio.push({ name: cleaned.name, score, created_at, day, fingerprint: clientFingerprint() });
  } else return { ok: false, error: "mode" };
  writeLocal(data);
  return { ok: true };
}

async function rpc(env, fn, body) {
  const response = await fetch(`${env.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || String(response.status));
  return payload;
}

export async function fetchTop(mode, day) {
  const env = boardEnv();
  if (!env.remote) return { source: "local", rows: localTop(mode, day) };
  try {
    const rows = await rpc(env, "top10", { p_mode: mode, p_day: mode === "daily" ? day : null });
    return { source: "remote", rows: Array.isArray(rows) ? rows : [] };
  } catch {
    return { source: "local", rows: localTop(mode, day), failed: true };
  }
}

export async function submitScore({ mode, day, name, score, details }) {
  const cleaned = sanitizeName(name);
  if (!cleaned.ok) return { ok: false, error: cleaned.error };
  if (!scoreInBounds(mode, score)) return { ok: false, error: "score" };
  const env = boardEnv();
  if (!env.remote) return localSubmit({ mode, day, name: cleaned.name, score });
  try {
    return await rpc(env, "submit_score", {
      p_mode: mode,
      p_day: day,
      p_name: cleaned.name,
      p_score: score,
      p_details: details || {},
      p_fingerprint: clientFingerprint(),
    });
  } catch {
    return { ok: false, error: "network" };
  }
}
