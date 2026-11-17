"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RegistrationForm } from "@/components/RegistrationForm";
import type { Category } from "@/lib/types";

export function EventControls({ slug, open, origin }: { slug: string; open: boolean; origin: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const link = `${origin}/e/${slug}`;
  async function toggle() {
    await fetch("/api/admin/evento", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, registrationOpen: !open }) });
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="break-all rounded bg-white px-2 py-1 border border-line text-sm">{link}</code>
      <button className="btn btn-dark btn-sm" onClick={async () => { await navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? "Copiado ✓" : "Copiar link"}</button>
      <button className="btn btn-line btn-sm" onClick={toggle}>{open ? "Encerrar inscrições" : "Reabrir inscrições"}</button>
    </div>
  );
}

type Draft = { gender?: string | null; fullName?: string; city?: string; team?: string; whatsapp?: string; birthDate?: string; emergencyContact?: string; email?: string; weightKg?: number | null };

export function AssistedPanel({ slug, ageRefDate, pixKey, categories }: { slug: string; ageRefDate: string; pixKey: string | null; categories: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ initial: Record<string, string>; key: number } | null>(null);

  async function read(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const form = new FormData(e.currentTarget);
    form.set("eventSlug", slug);
    const res = await fetch("/api/admin/rascunho", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data.error ?? "Não foi possível ler a mensagem.");
    const d: Draft = data.draft ?? {};
    if (!data.aiAvailable) setMsg("A IA não respondeu. Preencha os campos à mão.");
    else setMsg("Confira os campos abaixo antes de salvar.");
    setPrefill({
      key: Date.now(),
      initial: {
        fullName: d.fullName ?? "", gender: d.gender ?? "", city: d.city ?? "", team: d.team ?? "", whatsapp: d.whatsapp ?? "", birthDate: d.birthDate ?? "",
        emergencyContact: d.emergencyContact ?? "", email: d.email ?? "", weightKg: d.weightKg ? String(d.weightKg) : "", categoryId: data.categoryId ?? "",
      },
    });
  }

  if (!open) return <button className="btn btn-red" onClick={() => setOpen(true)}>+ Inscrever alguém (mensagem de WhatsApp)</button>;
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between"><h3 className="display text-3xl">Inscrição assistida</h3><button className="btn btn-line btn-sm" onClick={() => { setOpen(false); setPrefill(null); setMsg(null); }}>Fechar</button></div>
      <form onSubmit={read} className="space-y-3">
        <p className="hint">Cole o texto que o atleta mandou no WhatsApp, ou envie o print/foto da ficha. A IA preenche; você confere.</p>
        <textarea name="text" rows={4} className="field" placeholder="Cole a mensagem aqui…" />
        <input name="file" type="file" accept="image/*" className="field" />
        <button className="btn btn-dark" disabled={busy}>{busy ? "Lendo…" : "Ler mensagem"}</button>
      </form>
      {msg && <p className="rounded-xl bg-paper border border-line px-4 py-2">{msg}</p>}
      {prefill && (
        <RegistrationForm key={prefill.key} assisted eventSlug={slug} ageRefDate={ageRefDate} pixKey={pixKey} categories={categories}
          endpoint="/api/admin/inscricoes" initial={prefill.initial}
          onDone={(r) => { setMsg(`Inscrito com o número ${r.bibLabel}.`); setPrefill(null); router.refresh(); }} />
      )}
    </div>
  );
}

export function RafflePanel({ slug, winners }: { slug: string; winners: { name: string; bib: string; prize: string | null }[] }) {
  const router = useRouter();
  const [prize, setPrize] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function draw() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/sorteio", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, prizeLabel: prize || undefined }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data.error ?? "Erro no sorteio.");
    setMsg(`Sorteado: ${data.winner.bibLabel} — ${data.winner.fullName}`);
    router.refresh();
  }
  return (
    <div className="card p-5 space-y-3">
      <h3 className="display text-3xl">Sorteio</h3>
      <p className="hint">Concorre quem tem pagamento conferido e ainda não ganhou.</p>
      <div className="flex flex-wrap gap-2">
        <input className="field !w-auto flex-1" placeholder="Prêmio (opcional)" value={prize} onChange={(e) => setPrize(e.target.value)} />
        <button className="btn btn-red" onClick={draw} disabled={busy}>Sortear</button>
      </div>
      {msg && <p className="text-lg font-bold" role="status">{msg}</p>}
      {winners.length > 0 && <ul className="text-sm text-muted space-y-1">{winners.map((w, i) => <li key={i}><strong className="text-ink">{w.bib}</strong> {w.name}{w.prize ? ` — ${w.prize}` : ""}</li>)}</ul>}
    </div>
  );
}
