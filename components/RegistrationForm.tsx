"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { downscaleImage } from "@/lib/client/image";
import { ageOn, categoryRuleText, suggestCategory } from "@/lib/rules";
import { formatBRL } from "@/lib/text";
import type { Category, Gender } from "@/lib/types";

interface Props {
  eventSlug: string;
  /** Data em que a idade é medida (dia da prova ou 31/12). */
  ageRefDate: string;
  pixKey: string | null;
  categories: Category[];
  /** Painel do organizador usa o mesmo formulário (cadastro assistido). */
  endpoint?: string;
  initial?: Partial<Record<string, string>>;
  onDone?: (r: Result) => void;
  assisted?: boolean;
}

export interface Result {
  id: string;
  accessToken?: string;
  bibLabel: string;
  paymentStatus: "pending" | "verified" | "review" | "mismatch";
  exempt?: boolean;
  flags: string[];
  category: string;
  price: number;
  pixKey: string | null;
}

export function RegistrationForm({ eventSlug, ageRefDate, pixKey, categories, endpoint = "/api/inscricao", initial = {}, onDone, assisted }: Props) {
  const router = useRouter();
  const [birth, setBirth] = useState(initial.birthDate ?? "");
  const [gender, setGender] = useState<Gender | "">((initial.gender as Gender) ?? "");
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
  const [touchedCategory, setTouchedCategory] = useState(!!initial.categoryId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [orgCode, setOrgCode] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const category = categories.find((c) => c.id === categoryId);
  const suggestFor = (b: string, g: Gender | "") => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
    const age = ageOn(b, ageRefDate);
    return age >= 5 && age < 110 ? suggestCategory(age, categories, g || null) : null;
  };
  const suggested = useMemo(() => suggestFor(birth, gender), [birth, gender, ageRefDate, categories]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(b: string, g: Gender | "") {
    setBirth(b);
    setGender(g);
    if (!touchedCategory) {
      const s = suggestFor(b, g);
      if (s) setCategoryId(s.id);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    if (!categoryId) return setError("Escolha uma categoria.");
    form.set("categoryId", categoryId);
    form.set("eventSlug", eventSlug);
    form.set("termsAccepted", assisted ? "true" : form.get("termsAccepted") ? "true" : "false");
    const f = fileRef.current?.files?.[0];
    form.delete("file");
    if (f) form.set("file", await downscaleImage(f));
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: "POST", body: form });
      const data = await res.json().catch(() => ({ ok: false, error: "Resposta inesperada do servidor." }));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Não foi possível concluir a inscrição.");
      if (onDone) onDone(data);
      else if (data.accessToken) router.push(`/i/${data.accessToken}?nova=1`);
      else setError("Inscrição recebida. Fale com a organização para confirmar seu número.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha de conexão. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 sm:p-8 space-y-5" noValidate>
      {/* isca para robôs: invisível para pessoas */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div>
        <label className="label" htmlFor="fullName">Nome completo</label>
        <input id="fullName" name="fullName" className="field" required autoComplete="name" defaultValue={initial.fullName} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="whatsapp">WhatsApp (com DDD)</label>
          <input id="whatsapp" name="whatsapp" className="field" inputMode="tel" required autoComplete="tel" placeholder="81 99999-9999" defaultValue={initial.whatsapp} />
        </div>
        <div>
          <label className="label" htmlFor="birthDate">Data de nascimento</label>
          <input id="birthDate" name="birthDate" type="date" className="field" required value={birth} onChange={(e) => update(e.target.value, gender)} />
        </div>
        <div>
          <label className="label" htmlFor="gender">Sexo</label>
          <select id="gender" name="gender" className="field" required={!assisted} value={gender} onChange={(e) => update(birth, e.target.value as Gender | "")}>
            <option value="">Escolha…</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="city">Cidade</label>
          <input id="city" name="city" className="field" autoComplete="address-level2" defaultValue={initial.city} />
        </div>
        <div>
          <label className="label" htmlFor="team">Equipe / grupo de pedal</label>
          <input id="team" name="team" className="field" placeholder="Se não tiver, deixe em branco" defaultValue={initial.team} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="categoryId">Categoria</label>
        <select id="categoryId" className="field" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setTouchedCategory(true); }} required>
          <option value="">Escolha…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name} — {formatBRL(c.price)}</option>)}
        </select>
        {category && <p className="hint mt-1">{categoryRuleText(category)}</p>}
        {suggested && suggested.id !== categoryId && (
          <p className="hint mt-1">Pela sua idade, o comum é <button type="button" className="underline font-semibold" onClick={() => { setCategoryId(suggested.id); setTouchedCategory(true); }}>{suggested.name}</button>.</p>
        )}
      </div>

      {category?.minWeightKg != null && (
        <div>
          <label className="label" htmlFor="weightKg">Peso (kg)</label>
          <input id="weightKg" name="weightKg" className="field" inputMode="decimal" placeholder={`${category.minWeightKg} ou mais`} defaultValue={initial.weightKg} />
          <p className="hint mt-1">Esta categoria é para atletas a partir de {category.minWeightKg} kg.</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="emergencyContact">Contato de emergência</label>
          <input id="emergencyContact" name="emergencyContact" className="field" placeholder="Nome e telefone" defaultValue={initial.emergencyContact} />
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail <span className="hint font-normal">(opcional)</span></label>
          <input id="email" name="email" type="email" className="field" autoComplete="email" defaultValue={initial.email} />
        </div>
      </div>

      {!assisted && (
        <details className="rounded-xl border border-line px-4 py-3">
          <summary className="cursor-pointer font-semibold">Faço parte da organização do evento</summary>
          <div className="mt-3">
            <label className="label" htmlFor="exemptCode">Código da organização</label>
            <input id="exemptCode" name="exemptCode" className="field" autoComplete="off" autoCapitalize="none" value={orgCode} onChange={(e) => setOrgCode(e.target.value)} />
            <p className="hint mt-1">Quem recebeu o código da organização se inscreve sem pagar. Os demais ignoram este campo.</p>
          </div>
        </details>
      )}

      <div className={`rounded-xl bg-paper border border-line p-4 space-y-3 ${orgCode.trim() ? "opacity-50" : ""}`}>
        <p className="font-semibold">Pagamento por Pix{category ? ` — ${formatBRL(category.price)}` : ""}</p>
        {orgCode.trim() && <p className="hint">Com o código da organização você não precisa pagar nem enviar comprovante.</p>}
        {pixKey ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 border border-line">{pixKey}</code>
            <button type="button" className="btn btn-line btn-sm" onClick={async () => { await navigator.clipboard?.writeText(pixKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? "Copiado ✓" : "Copiar chave"}
            </button>
          </div>
        ) : <p className="hint">A organização informará a chave Pix.</p>}
        <div>
          <label className="label" htmlFor="file">Comprovante (foto, print ou PDF)</label>
          <input id="file" name="file" ref={fileRef} type="file" accept="image/*,application/pdf" className="field" />
          <p className="hint mt-1">Pode enviar agora ou depois. Sua vaga só é confirmada com o pagamento conferido.</p>
        </div>
      </div>

      {!assisted && (
        <label className="flex items-start gap-3">
          <input type="checkbox" name="termsAccepted" className="mt-1.5 size-5 accent-red" required />
          <span className="text-[0.95rem]">Declaro que estou apto(a) fisicamente e assumo a responsabilidade pela minha participação, seguindo as regras da organização e usando capacete.</span>
        </label>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-900 px-4 py-3">{error}</p>}
      <button className="btn btn-red w-full text-lg" disabled={busy}>{busy ? "Enviando… (conferindo comprovante)" : assisted ? "Salvar inscrição" : "Fazer minha inscrição"}</button>
    </form>
  );
}
