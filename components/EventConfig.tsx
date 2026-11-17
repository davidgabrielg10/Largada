"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { categoryRuleText } from "@/lib/rules";
import { formatBRL } from "@/lib/text";
import type { AgeRule, Category, Gender } from "@/lib/types";
import type { PrizeForm } from "@/lib/prizes";

export interface EventFields {
  name: string;
  eventDate: string;
  city: string | null;
  description: string | null;
  pixKey: string | null;
  basePrice: number;
  ageRule: AgeRule;
  hasKit: boolean;
  exemptCode: string | null;
}

async function send(url: string, method: string, body?: object): Promise<{ ok: boolean; error?: string; slug?: string }> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, ...data } : { ok: false, error: data.error ?? "Não foi possível salvar." };
}

const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function EventFieldsInputs({ v }: { v?: Partial<EventFields> }) {
  return (
    <>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="ev-name">Nome do evento</label>
        <input id="ev-name" name="name" className="field" required defaultValue={v?.name} placeholder="Ex.: 3º Pedal da Serra" />
      </div>
      <div>
        <label className="label" htmlFor="ev-date">Data</label>
        <input id="ev-date" name="eventDate" type="date" className="field" required defaultValue={v?.eventDate} />
      </div>
      <div>
        <label className="label" htmlFor="ev-city">Cidade</label>
        <input id="ev-city" name="city" className="field" defaultValue={v?.city ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="ev-pix">Chave Pix</label>
        <input id="ev-pix" name="pixKey" className="field" defaultValue={v?.pixKey ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="ev-price">Valor padrão da inscrição (R$)</label>
        <input id="ev-price" name="basePrice" inputMode="decimal" className="field" required defaultValue={v?.basePrice ?? 80} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="ev-age">Como contar a idade</label>
        <select id="ev-age" name="ageRule" className="field" defaultValue={v?.ageRule ?? "event_date"}>
          <option value="event_date">Idade no dia da prova</option>
          <option value="year_end">Idade que o atleta completa no ano (regra comum no ciclismo)</option>
        </select>
      </div>
      <label className="flex items-start gap-3 sm:col-span-2">
        <input type="checkbox" name="hasKit" className="mt-1.5 size-5 accent-red" defaultChecked={v?.hasKit ?? false} />
        <span><strong>Este evento entrega kit</strong><br /><span className="hint">Camisa, numeral etc. Se marcado, a tela de entrada ganha o botão “Entregar kit”. Se não, só a presença é registrada.</span></span>
      </label>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="ev-code">Código de isenção da organização <span className="hint font-normal">(opcional)</span></label>
        <input id="ev-code" name="exemptCode" className="field" autoComplete="off" defaultValue={v?.exemptCode ?? ""} placeholder="ex.: equipe-2026" />
        <p className="hint mt-1">Quem digitar este código no formulário se inscreve isento, sem Pix. Passe só para a organização e troque se vazar. Deixe em branco para desligar.</p>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="ev-desc">Recado para os atletas</label>
        <textarea id="ev-desc" name="description" rows={3} className="field" defaultValue={v?.description ?? ""} placeholder="Regras, horário de largada, local da retirada do kit…" />
      </div>
    </>
  );
}

function readEvent(f: FormData): EventFields {
  return {
    name: val(f, "name"), eventDate: val(f, "eventDate"), city: val(f, "city") || null, description: val(f, "description") || null,
    pixKey: val(f, "pixKey") || null, basePrice: Number(val(f, "basePrice").replace(",", ".")), ageRule: val(f, "ageRule") as AgeRule, hasKit: f.get("hasKit") === "on", exemptCode: val(f, "exemptCode") || null,
  };
}

export function NewEventForm({ events }: { events: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return <button className="btn btn-red" onClick={() => setOpen(true)}>+ Criar evento</button>;
  return (
    <form className="card grid gap-4 p-5 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setError(null);
      const f = new FormData(e.currentTarget);
      const r = await send("/api/admin/eventos", "POST", { ...readEvent(f), copyFrom: val(f, "copyFrom") || null });
      setBusy(false);
      if (!r.ok) return setError(r.error!);
      router.push(`/admin/${r.slug}/configurar`);
    }}>
      <h2 className="display text-3xl sm:col-span-2">Novo evento</h2>
      <EventFieldsInputs />
      <div className="sm:col-span-2">
        <label className="label" htmlFor="ev-copy">Categorias</label>
        <select id="ev-copy" name="copyFrom" className="field" defaultValue={events[0]?.slug ?? ""}>
          <option value="">Começar sem categorias</option>
          {events.map((e) => <option key={e.slug} value={e.slug}>Copiar categorias e premiação de: {e.name}</option>)}
        </select>
        <p className="hint mt-1">Depois você ajusta cada categoria. Os inscritos não são copiados.</p>
      </div>
      {error && <p role="alert" className="text-red-800 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn btn-red" disabled={busy}>{busy ? "Criando…" : "Criar e configurar"}</button>
        <button type="button" className="btn btn-line" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  );
}

export function EventSettings({ slug, event }: { slug: string; event: EventFields }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="card grid gap-4 p-5 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setMsg(null);
      const r = await send(`/api/admin/eventos/${slug}`, "PATCH", readEvent(new FormData(e.currentTarget)));
      setBusy(false);
      setMsg(r.ok ? { ok: true, text: "Salvo." } : { ok: false, text: r.error! });
      if (r.ok) router.refresh();
    }}>
      <EventFieldsInputs v={event} />
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn btn-dark" disabled={busy}>{busy ? "Salvando…" : "Salvar dados do evento"}</button>
        {msg && <p role="status" className={msg.ok ? "text-ok font-semibold" : "text-red-800"}>{msg.text}</p>}
      </div>
    </form>
  );
}

export interface CategoryView extends Category {
  athletes: number;
  prizes: PrizeForm;
}

const num = (s: string) => (s === "" ? null : Number(s.replace(",", ".")));

function CategoryForm({ slug, cat, basePrice, onDone }: { slug: string; cat?: CategoryView; basePrice: number; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="grid gap-3 sm:grid-cols-6" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setError(null);
      const f = new FormData(e.currentTarget);
      const body = {
        name: val(f, "name"), price: num(val(f, "price")), minAge: num(val(f, "minAge")), maxAge: num(val(f, "maxAge")),
        minWeightKg: num(val(f, "minWeightKg")), minAthletes: num(val(f, "minAthletes")) ?? 0,
        gender: (val(f, "gender") || null) as Gender | null,
        prizes: {
          money: val(f, "money").replace(/\.(\d{3})(?!\d)/g, "$1").replace(/(\d),(\d{2})(?!\d)/g, "$1.$2")
            .split(/[;\s/,]+/).filter(Boolean).map(Number),
          trophyUntil: num(val(f, "trophyUntil")) ?? 0,
        },
      };
      const r = await send(cat ? `/api/admin/eventos/${slug}/categorias/${cat.id}` : `/api/admin/eventos/${slug}/categorias`, cat ? "PATCH" : "POST", body);
      setBusy(false);
      if (!r.ok) return setError(r.error!);
      onDone();
    }}>
      <div className="sm:col-span-4"><label className="label">Nome</label><input name="name" className="field" required defaultValue={cat?.name} placeholder="Ex.: Master 40+" /></div>
      <div className="sm:col-span-2"><label className="label">Valor (R$)</label><input name="price" inputMode="decimal" className="field" required defaultValue={cat?.price ?? basePrice} /></div>
      <div className="sm:col-span-2"><label className="label">Idade mínima</label><input name="minAge" inputMode="numeric" className="field" defaultValue={cat?.minAge ?? ""} placeholder="sem limite" /></div>
      <div className="sm:col-span-2"><label className="label">Idade máxima</label><input name="maxAge" inputMode="numeric" className="field" defaultValue={cat?.maxAge ?? ""} placeholder="sem limite" /></div>
      <div className="sm:col-span-2"><label className="label">Sexo</label>
        <select name="gender" className="field" defaultValue={cat?.gender ?? ""}><option value="">Todos</option><option value="F">Só feminino</option><option value="M">Só masculino</option></select>
      </div>
      <div className="sm:col-span-2"><label className="label">Peso mínimo (kg)</label><input name="minWeightKg" inputMode="decimal" className="field" defaultValue={cat?.minWeightKg ?? ""} placeholder="não pede peso" /></div>
      <div className="sm:col-span-2"><label className="label">Mínimo de atletas</label><input name="minAthletes" inputMode="numeric" className="field" defaultValue={cat?.minAthletes ?? 10} /></div>
      <div className="sm:col-span-2"><label className="label">Troféu até o lugar</label><input name="trophyUntil" inputMode="numeric" className="field" defaultValue={cat?.prizes.trophyUntil || ""} placeholder="ex.: 5" /></div>
      <div className="sm:col-span-6"><label className="label">Premiação em dinheiro, do 1º lugar em diante</label>
        <input name="money" className="field" defaultValue={cat?.prizes.money.join("  ") ?? ""} placeholder="ex.: 200 150 100" />
        <p className="hint mt-1">Separe os valores por espaço. Abaixo do mínimo de atletas, o painel avisa para unificar a categoria.</p>
      </div>
      {error && <p role="alert" className="text-red-800 sm:col-span-6">{error}</p>}
      <div className="flex gap-2 sm:col-span-6">
        <button className="btn btn-red btn-sm" disabled={busy}>{busy ? "Salvando…" : cat ? "Salvar categoria" : "Adicionar categoria"}</button>
        <button type="button" className="btn btn-line btn-sm" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  );
}

export function CategoryEditor({ slug, categories, basePrice }: { slug: string; categories: CategoryView[]; basePrice: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const done = () => { setEditing(null); router.refresh(); };
  async function act(url: string, method: string, body?: object) {
    setError(null);
    const r = await send(url, method, body);
    if (!r.ok) setError(r.error!);
    router.refresh();
  }
  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-900 px-4 py-3">{error}</p>}
      {categories.map((c, i) => (
        <article key={c.id} className="card p-4">
          {editing === c.id ? <CategoryForm slug={slug} cat={c} basePrice={basePrice} onDone={done} /> : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 basis-full sm:basis-0">
                <p className="text-lg font-bold">{c.name} <span className="font-normal text-muted">· {formatBRL(c.price)}</span></p>
                <p className="text-sm text-muted">
                  {categoryRuleText(c)} · mínimo {c.minAthletes} atletas
                  {c.prizes.money.length > 0 && ` · prêmios ${c.prizes.money.map((m) => formatBRL(m)).join(" / ")}`}
                  {c.prizes.trophyUntil > 0 && ` · troféu até o ${c.prizes.trophyUntil}º`}
                </p>
                <p className="text-sm">{c.athletes} inscrito{c.athletes === 1 ? "" : "s"}</p>
              </div>
              <div className="flex gap-1.5">
                <button aria-label="Subir" className="btn btn-line btn-sm" disabled={i === 0} onClick={() => act(`/api/admin/eventos/${slug}/categorias/${c.id}`, "PATCH", { move: "up" })}>↑</button>
                <button aria-label="Descer" className="btn btn-line btn-sm" disabled={i === categories.length - 1} onClick={() => act(`/api/admin/eventos/${slug}/categorias/${c.id}`, "PATCH", { move: "down" })}>↓</button>
                <button className="btn btn-dark btn-sm" onClick={() => setEditing(c.id)}>Editar</button>
                <button className="btn btn-line btn-sm" disabled={c.athletes > 0} title={c.athletes > 0 ? "Há inscritos nesta categoria" : undefined}
                  onClick={() => confirm(`Excluir a categoria ${c.name}?`) && act(`/api/admin/eventos/${slug}/categorias/${c.id}`, "DELETE")}>Excluir</button>
              </div>
            </div>
          )}
        </article>
      ))}
      {!categories.length && <p className="card p-5 text-muted">Nenhuma categoria ainda. Sem categoria, o formulário não aceita inscrições.</p>}
      {editing === "new" ? <div className="card p-4"><CategoryForm slug={slug} basePrice={basePrice} onDone={done} /></div>
        : <button className="btn btn-red" onClick={() => setEditing("new")}>+ Nova categoria</button>}
    </div>
  );
}
