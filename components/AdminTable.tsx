"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatClock } from "@/lib/format";
import { FLAG_LABELS } from "@/lib/receipt";
import type { Flag, PaymentStatus } from "@/lib/types";

export interface Row {
  id: string;
  bib: string;
  name: string;
  city: string | null;
  team: string | null;
  categoryId: string;
  status: "active" | "cancelled";
  payment: PaymentStatus;
  exempt: boolean;
  flags: Flag[];
  receiptUrls: string[];
  waConfirm: string; // link wa.me com a mensagem pronta
  waReminder: string;
  kit: boolean;
  /** Horário da presença (ISO) ou null. */
  checkedInAt: string | null;
}

const PAY: Record<PaymentStatus, [string, string]> = {
  verified: ["Pago", "pill-ok"], review: ["Conferir", "pill-warn"], mismatch: ["Divergente", "pill-bad"], pending: ["Sem pagamento", "pill-idle"],
};
const FILTERS: [string, string, boolean][] = [
  ["todos", "Todos", false], ["fila", "Fila de conferência", false], ["pagos", "Pagos", false], ["pendentes", "Sem pagamento", false],
  ["presentes", "Presentes", false], ["ausentes", "Ausentes", false], ["semkit", "Kit pendente", true], ["cancelados", "Cancelados", false],
];

export function AdminTable({ rows, categories, hasKit }: { rows: Row[]; categories: { id: string; name: string }[]; hasKit: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState("todos");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";
  const shown = useMemo(() => rows.filter((r) => {
    const active = r.status === "active";
    if (filter === "fila" && !(active && (r.payment === "review" || r.payment === "mismatch"))) return false;
    if (filter === "pagos" && !(active && r.payment === "verified")) return false;
    if (filter === "pendentes" && !(active && r.payment === "pending")) return false;
    if (filter === "presentes" && !(active && r.checkedInAt)) return false;
    if (filter === "ausentes" && !(active && !r.checkedInAt)) return false;
    if (filter === "semkit" && !(active && !r.kit)) return false;
    if (filter === "cancelados" && active) return false;
    if (filter !== "cancelados" && filter !== "todos" && !active) return false;
    const t = q.trim().toLowerCase();
    return !t || `${r.name} ${r.bib} ${r.city ?? ""} ${r.team ?? ""}`.toLowerCase().includes(t);
  }), [rows, filter, q]);

  async function patch(id: string, body: object) {
    setBusyId(id); setError(null);
    const res = await fetch(`/api/admin/inscricoes/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) return setError(data.error ?? "Não foi possível salvar.");
    router.refresh();
  }

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = ["Número", "Nome", "Cidade", "Equipe", "Categoria", "Pagamento", "Presença", ...(hasKit ? ["Kit"] : []), "Situação"];
    const lines = [head.join(",")].concat(
      rows.map((r) => [r.bib, r.name, r.city ?? "", r.team ?? "", catName(r.categoryId), r.exempt ? "Isento" : PAY[r.payment][0], r.checkedInAt ? formatClock(r.checkedInAt) : "", ...(hasKit ? [r.kit ? "Entregue" : ""] : []), r.status === "active" ? "Ativa" : "Cancelada"].map(esc).join(",")),
    );
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "inscritos.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.filter(([, , kitOnly]) => hasKit || !kitOnly).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`btn btn-sm ${filter === k ? "btn-dark" : "btn-line"}`}>{l}</button>
        ))}
        <input className="field !min-h-9 !py-1 max-w-56 ml-auto" placeholder="Buscar nome, nº, cidade…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar inscrito" />
        <button onClick={exportCsv} className="btn btn-line btn-sm">Baixar planilha</button>
      </div>
      {error && <p role="alert" className="mt-3 text-red-800">{error}</p>}
      <div className="mt-4 space-y-3">
        {shown.map((r) => {
          const [label, tone] = r.exempt ? (["Isento", "pill-ok"] as const) : PAY[r.payment];
          const busy = busyId === r.id;
          return (
            <article key={r.id} className={`card p-4 ${r.status === "cancelled" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <p className="display text-4xl text-red leading-none w-16">{r.bib}</p>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-lg leading-tight">{r.name}</p>
                  <p className="text-muted text-sm">{[r.city, r.team].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.checkedInAt && <span className="pill pill-ok">Presente {formatClock(r.checkedInAt)}</span>}
                  {hasKit && r.kit && <span className="pill pill-ok">Kit entregue</span>}
                  <span className={`pill ${r.status === "cancelled" ? "pill-idle" : tone}`}>{r.status === "cancelled" ? "Cancelada" : label}</span>
                </div>
              </div>
              {r.flags.length > 0 && r.status === "active" && (
                <ul className="mt-2 flex flex-wrap gap-1.5">{r.flags.map((f) => <li key={f} className="pill pill-warn">{FLAG_LABELS[f]}</li>)}</ul>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select aria-label="Categoria" className="field !min-h-9 !py-1 !w-auto text-sm" value={r.categoryId} disabled={busy} onChange={(e) => patch(r.id, { categoryId: e.target.value })}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {r.status === "active" ? (
                  <>
                    {r.payment !== "verified" && <button disabled={busy} className="btn btn-red btn-sm" onClick={() => patch(r.id, { action: "approve" })}>Aprovar pagamento</button>}
                    {r.exempt
                      ? <button disabled={busy} className="btn btn-line btn-sm" onClick={() => patch(r.id, { action: "unexempt" })}>Tirar isenção</button>
                      : <button disabled={busy} className="btn btn-line btn-sm" onClick={() => confirm(`Isentar ${r.name} do pagamento? Ele fica liberado e fora do faturamento.`) && patch(r.id, { action: "exempt" })}>Isentar</button>}
                    {r.payment !== "mismatch" && r.payment !== "verified" && <button disabled={busy} className="btn btn-line btn-sm" onClick={() => patch(r.id, { action: "reject" })}>Marcar divergente</button>}
                    <button disabled={busy} className="btn btn-line btn-sm" onClick={() => patch(r.id, { action: r.checkedInAt ? "uncheckin" : "checkin" })}>{r.checkedInAt ? "Desfazer presença" : "Marcar presença"}</button>
                    {hasKit && <button disabled={busy} className="btn btn-line btn-sm" onClick={() => patch(r.id, { action: r.kit ? "unkit" : "kit" })}>{r.kit ? "Desfazer kit" : "Entregar kit"}</button>}
                    <button disabled={busy} className="btn btn-line btn-sm" onClick={() => confirm(`Cancelar a inscrição de ${r.name}? O número ${r.bib} não será reaproveitado.`) && patch(r.id, { action: "cancel" })}>Cancelar</button>
                  </>
                ) : (
                  <button disabled={busy} className="btn btn-line btn-sm" onClick={() => patch(r.id, { action: "reopen" })}>Reativar</button>
                )}
                {r.receiptUrls.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer" className="btn btn-line btn-sm">Comprovante{r.receiptUrls.length > 1 ? ` ${i + 1}` : ""}</a>)}
                <a href={r.payment === "verified" ? r.waConfirm : r.waReminder} target="_blank" rel="noreferrer" className="btn btn-dark btn-sm">
                  {r.payment === "verified" ? "WhatsApp: confirmação" : "WhatsApp: cobrar"}
                </a>
              </div>
            </article>
          );
        })}
        {!shown.length && <p className="card p-6 text-center text-muted">Ninguém nesta lista.</p>}
      </div>
    </div>
  );
}
