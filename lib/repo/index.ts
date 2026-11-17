import { MemoryRepo } from "./memory";
import { SupabaseRepo } from "./supabase";
import type { Repo } from "./types";

export * from "./types";

const g = globalThis as unknown as { __largadaRepo?: Repo };

/**
 * Supabase quando há NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Sem elas: em desenvolvimento usa memória com dados fictícios; em produção falha
 * de propósito (melhor erro claro do que dados que somem).
 */
export function getRepo(): Repo {
  if (g.__largadaRepo) return g.__largadaRepo;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) g.__largadaRepo = new SupabaseRepo(url, key);
  else if (process.env.NODE_ENV === "production") throw new Error("Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  else g.__largadaRepo = new MemoryRepo(true);
  return g.__largadaRepo;
}
