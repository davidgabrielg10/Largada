/** minúsculas, sem acento, só letras/números separados por espaço. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NAME_STOPWORDS = new Set(["de", "da", "do", "dos", "das", "e"]);

export function nameTokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length >= 2 && !NAME_STOPWORDS.has(t));
}

/**
 * Quanto dois nomes se parecem (0 a 1): proporção de palavras do nome mais
 * curto que aparecem no mais longo. "Ana Souza" x "Ana Maria de Souza" = 1.
 * Palavras abreviadas ("J." ) casam com a inicial.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const pool = [...long];
  let hits = 0;
  for (const t of short) {
    const idx = pool.findIndex((p) => p === t || (t.length === 1 && p.startsWith(t)));
    if (idx >= 0) {
      hits++;
      pool.splice(idx, 1);
    }
  }
  return hits / short.length;
}

export function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

/** Valor curto para cartões: "R$ 12.400" (sem centavos quando é valor redondo). */
export function formatBRLShort(n: number): string {
  const d = Number.isInteger(n) ? 0 : 2;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}

/** 1 -> "001"; 1000 -> "1000". */
export function formatBib(n: number): string {
  return n < 1000 ? String(n).padStart(3, "0") : String(n);
}

export function onlyDigits(s: string): string {
  return s.replace(/\D+/g, "");
}

/** Telefone brasileiro só com dígitos (DDD + número); null se inválido. */
export function normalizePhone(s: string): string | null {
  let d = onlyDigits(s);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? d : null;
}

export function formatPhone(d: string): string {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/** Aceita "2026-03-21" ou "21/03/2026"; devolve YYYY-MM-DD ou null. */
export function toISODate(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/.exec(t))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
