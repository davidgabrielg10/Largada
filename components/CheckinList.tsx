"use client";

import { useMemo, useState } from "react";
import { formatClock } from "@/lib/format";
import type { PaymentStatus } from "@/lib/types";

export interface ListRow {
  id: string;
  bib: string;
  name: string;
  city: string | null;
  team: string | null;
  payment: PaymentStatus;
  exempt: boolean;
  checkedInAt: string | null;
  kitAt: string | null;
}
export interface ListGroup {
  id: string;
  name: string;
  rows: ListRow[];
}

const PAY: Record<PaymentStatus, [string, string]> = {
  verified: ["Pago", "pill-ok"], review: ["Conferir", "pill-warn"], mismatch: ["Divergente", "pill-bad"], pending: ["Sem pagto", "pill-idle"],
};

/** Lista do dia da prova: por categoria, com presença marcável e pronta para imprimir. */
export function CheckinList({ groups: initial, hasKit }: { groups: ListGroup[]; hasKit: boolean }) {
  const [groups, setGroups] = useState(initial);
  const [filter, setFilter] = useState<"todos" | "presentes" | "ausentes">("todos");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: string) {
    setBusyId(id); setError(null);
    try {
      const res = await fetch(`/api/admin/inscricoes/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setError(d.error ?? "Não foi possível salvar.");
      setGroups((gs) => gs.map((g) => ({ ...g, rows: g.rows.map((r) => (r.id === id ? { ...r, checkedInAt: d.checkedInAt ?? null, kitAt: d.kitDeliveredAt ?? null } : r)) })));
    } catch {
      setError("Sem conexão. Anote na lista impressa e marque depois.");
    } finally {
      setBusyId(null);
    }
  }

  const term = q.trim().toLowerCase();
  const visible = useMemo(() => groups.map((g) => ({
    ...g,
    shown: g.rows.filter((r) => {
      if (filter === "presentes" && !r.checkedInAt) return false;
      if (filter === "ausentes" && r.checkedInAt) return false;
      return !term || `${r.bib} ${r.name} ${r.city ?? ""} ${r.team ?? ""}`.toLowerCase().includes(term);
    }),
  })).filter((g) => g.shown.length > 0 || (!term && filter === "todos")), [groups, filter, term]);

  const all = groups.flatMap((g) => g.rows);
  const present = all.filter((r) => r.checkedInAt).length;

  return (
    <div>
      <div className="print:hidden space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["todos", "presentes", "ausentes"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm capitalize ${filter === f ? "btn-dark" : "btn-line"}`}>{f}</button>
          ))}
          <input className="field !min-h-9 !py-1 w-full sm:w-auto sm:max-w-64 sm:flex-1" placeholder="Buscar nº, nome, cidade…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar atleta" />
          <button className="btn btn-line btn-sm ml-auto" onClick={() => window.print()}>Imprimir lista</button>
        </div>
        <p className="text-lg font-bold" aria-live="polite">{present} {present === 1 ? "presente" : "presentes"} de {all.length} {all.length === 1 ? "inscrito" : "inscritos"}</p>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">{error}</p>}
      </div>

      <div className="mt-4 space-y-6 print:mt-2 print:space-y-4">
        {visible.map((g) => {
          const paid = g.rows.filter((r) => r.payment === "verified").length;
          const here = g.rows.filter((r) => r.checkedInAt).length;
          return (
            <section key={g.id} className="card overflow-hidden print:break-inside-auto print:rounded-none print:border-ink">
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 bg-ink px-4 py-2 text-white print:bg-white print:text-ink print:border-b print:border-ink">
                <h2 className="display text-3xl">{g.name}</h2>
                <p className="text-sm font-semibold">{g.rows.length} {g.rows.length === 1 ? "inscrito" : "inscritos"} · {paid} {paid === 1 ? "pago" : "pagos"} · {here} {here === 1 ? "presente" : "presentes"}</p>
              </header>
              {g.shown.length === 0 ? <p className="px-4 py-3 text-muted">Ninguém nesta categoria.</p> : (
                <table className="w-full text-left">
                  <thead className="sr-only print:not-sr-only print:text-xs"><tr><th>Nº</th><th>Atleta</th><th>Pagamento</th><th>Presença</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {g.shown.map((r) => (
                      <tr key={r.id} className="align-middle print:break-inside-avoid">
                        <td className="display w-16 px-3 py-2 text-3xl text-red print:text-ink">{r.bib}</td>
                        <td className="py-2 pr-2">
                          <p className="font-bold leading-tight">{r.name}</p>
                          <p className="text-sm text-muted">{[r.city, r.team].filter(Boolean).join(" · ") || "—"}</p>
                        </td>
                        <td className="hidden px-2 sm:table-cell"><span className={`pill ${r.exempt ? "pill-ok" : PAY[r.payment][1]}`}>{r.exempt ? "Isento" : PAY[r.payment][0]}</span></td>
                        <td className="px-3 py-2 text-right">
                          <div className="print:hidden flex flex-col items-end gap-1 sm:flex-row sm:justify-end">
                            <span className={`pill sm:hidden ${r.exempt ? "pill-ok" : PAY[r.payment][1]}`}>{r.exempt ? "Isento" : PAY[r.payment][0]}</span>
                            <button
                              disabled={busyId === r.id}
                              className={`btn btn-sm ${r.checkedInAt ? "btn-line" : "btn-red"}`}
                              onClick={() => {
                                if (r.checkedInAt) return confirm(`Desfazer a presença de ${r.name}?`) && act(r.id, "uncheckin");
                                if (r.payment !== "verified" && !confirm(`${r.name}: pagamento ainda não conferido. Marcar presença mesmo assim?`)) return;
                                act(r.id, "checkin");
                              }}
                            >
                              {r.checkedInAt ? `✔ ${formatClock(r.checkedInAt)}` : "Marcar presença"}
                            </button>
                            {hasKit && (
                              <button disabled={busyId === r.id} className={`btn btn-sm ${r.kitAt ? "btn-line" : "btn-dark"}`} onClick={() => act(r.id, r.kitAt ? "unkit" : "kit")}>
                                {r.kitAt ? "Kit ✔" : "Kit"}
                              </button>
                            )}
                          </div>
                          {/* na impressão: caixinha para marcar à caneta, ou o ✔ se já marcado */}
                          <span className="hidden print:inline text-lg">{r.checkedInAt ? `✔ ${formatClock(r.checkedInAt)}` : "☐"}{hasKit ? (r.kitAt ? "  Kit ✔" : "  Kit ☐") : ""}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
        {!visible.length && <p className="card p-6 text-center text-muted">Ninguém encontrado.</p>}
      </div>
    </div>
  );
}
