"use client";

import { useState } from "react";
import { formatWhen } from "@/lib/format";

interface Props {
  id: string;
  cancelled: boolean;
  paid: boolean;
  hasKit: boolean;
  initialCheckedInAt: string | null;
  initialKitAt: string | null;
  flags: string[];
}

type Banner = { tone: "ok" | "bad" | "warn"; title: string; text: string };

/**
 * Tela do QR no dia da prova. O estado vive aqui: depois de confirmar, a faixa vira
 * "PRESENÇA CONFIRMADA" na hora; ao reabrir o QR depois, vira "JÁ UTILIZADO".
 */
export function EntryPanel({ id, cancelled, paid: paidInitial, hasKit, initialCheckedInAt, initialKitAt, flags }: Props) {
  const [paid, setPaid] = useState(paidInitial);
  const [checkedInAt, setCheckedInAt] = useState(initialCheckedInAt);
  const [kitAt, setKitAt] = useState(initialKitAt);
  const [justNow, setJustNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: string) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/inscricoes/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setError(d.error ?? "Não foi possível salvar. Tente de novo.");
      setPaid(d.paymentStatus === "verified");
      setCheckedInAt(d.checkedInAt ?? null);
      setKitAt(d.kitDeliveredAt ?? null);
      if (action === "checkin") setJustNow(!d.already);
      if (action === "uncheckin") setJustNow(false);
    } catch {
      setError("Sem conexão. Confirme pela lista de largada ou tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  let banner: Banner;
  if (cancelled) banner = { tone: "bad", title: "NÃO LIBERADO", text: "Inscrição cancelada." };
  else if (!paid) banner = { tone: "bad", title: "NÃO LIBERADO", text: "Pagamento ainda não conferido." };
  else if (checkedInAt && justNow) banner = { tone: "ok", title: "PRESENÇA CONFIRMADA", text: `Registrada em ${formatWhen(checkedInAt)}.` };
  else if (checkedInAt) banner = { tone: "warn", title: "JÁ UTILIZADO", text: `Presença já registrada em ${formatWhen(checkedInAt)}. Confira o documento do atleta.` };
  else banner = { tone: "ok", title: "LIBERADO", text: "Inscrição ativa e paga." };

  const tone = { ok: "bg-green-600", bad: "bg-red", warn: "bg-amber-500 text-ink" }[banner.tone];
  const showFlags = flags.filter((f) => f !== "no_receipt");

  return (
    <div className="space-y-4">
      <div role="status" className={`rounded-2xl px-5 py-5 text-center text-white ${tone}`}>
        <p className="display text-5xl">{banner.title}</p>
        <p className="mt-1 font-semibold">{banner.text}</p>
      </div>

      {showFlags.length > 0 && <p className="text-center text-sm text-muted">Alertas na inscrição: veja o painel.</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">{error}</p>}

      {!cancelled && !paid && (
        <button className="btn btn-dark w-full text-lg" disabled={busy} onClick={() => act("approve")}>
          {busy ? "Salvando…" : "Aprovar pagamento (conferido na hora)"}
        </button>
      )}

      {!cancelled && paid && !checkedInAt && (
        <button className="btn btn-red w-full text-lg" disabled={busy} onClick={() => act("checkin")}>{busy ? "Salvando…" : "Confirmar presença"}</button>
      )}

      {!cancelled && paid && hasKit && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="font-semibold">Kit: {kitAt ? <span className="text-ok">entregue em {formatWhen(kitAt)}</span> : "não entregue"}</p>
          <button className={`btn btn-sm ${kitAt ? "btn-line" : "btn-dark"}`} disabled={busy} onClick={() => act(kitAt ? "unkit" : "kit")}>
            {kitAt ? "Desfazer" : "Entregar kit"}
          </button>
        </div>
      )}

      {!cancelled && checkedInAt && (
        <button className="btn btn-line btn-sm mx-auto flex" disabled={busy} onClick={() => confirm("Desfazer a presença? Use só se foi marcada por engano.") && act("uncheckin")}>
          Desfazer presença
        </button>
      )}
    </div>
  );
}
