import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Autenticação do organizador: um PIN (ADMIN_PIN) troca por um cookie assinado.
// Sem login de usuário, sem senha por pessoa: o PIN fica só com a organização.

const COOKIE = "largada_admin";
const MAX_AGE_S = 60 * 60 * 24 * 7;

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PIN;
  if (!s) throw new Error("Defina ADMIN_PIN (e, de preferência, ADMIN_SESSION_SECRET).");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function pinIsValid(pin: string): boolean {
  const expected = process.env.ADMIN_PIN;
  return !!expected && safeEqual(createHmac("sha256", "pin").update(pin).digest("hex"), createHmac("sha256", "pin").update(expected).digest("hex"));
}

export function makeToken(now = Date.now()): string {
  const exp = String(now + MAX_AGE_S * 1000);
  return `${exp}.${sign(exp)}`;
}

export function tokenIsValid(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  return safeEqual(sig, sign(exp)) && Number(exp) > now;
}

export async function isAdmin(): Promise<boolean> {
  try {
    return tokenIsValid((await cookies()).get(COOKIE)?.value);
  } catch {
    return false;
  }
}

export async function startSession() {
  (await cookies()).set(COOKIE, makeToken(), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE_S,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}
