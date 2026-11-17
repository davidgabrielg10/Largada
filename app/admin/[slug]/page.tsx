import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminTable, type Row } from "@/components/AdminTable";
import { AssistedPanel, EventControls, RafflePanel } from "@/components/AdminTools";
import { LoginForm, LogoutButton } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";
import { getAI } from "@/lib/ai";
import { isAdmin } from "@/lib/auth";
import { confirmationMessage, paymentReminder } from "@/lib/messages";
import { getOrigin } from "@/lib/origin";
import { getRepo } from "@/lib/repo";
import { ageReference } from "@/lib/rules";
import { StatCard } from "@/components/StatCard";
import { formatBRLShort, onlyDigits } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel" };

export default async function Dashboard({ params }: PageProps<"/admin/[slug]">) {
  const { slug } = await params;
  if (!(await isAdmin())) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-6">
        <Link href="/"><Logo /></Link>
        <LoginForm />
      </main>
    );
  }
  const repo = getRepo();
  const event = await repo.getEventBySlug(slug);
  if (!event) notFound();
  const [categories, regs, draws] = await Promise.all([repo.listCategories(event.id), repo.listRegistrations(event.id), repo.listDraws(event.id)]);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const origin = await getOrigin();
  const ai = getAI();

  const active = regs.filter((r) => r.status === "active");
  const paid = active.filter((r) => r.paymentStatus === "verified" && !r.exempt);
  const exempt = active.filter((r) => r.exempt);
  const queue = active.filter((r) => r.paymentStatus === "review" || r.paymentStatus === "mismatch");
  const money = (rs: typeof active) => rs.reduce((s, r) => s + (catById.get(r.categoryId)?.price ?? 0), 0);

  const rows: Row[] = await Promise.all(regs.map(async (r) => {
    const cat = catById.get(r.categoryId)!;
    const wa = (text: string) => `https://wa.me/55${onlyDigits(r.whatsapp)}?text=${encodeURIComponent(text)}`;
    const urls = (await Promise.all(r.receipts.map((x) => repo.getFileUrl(x.storagePath)))).filter((u): u is string => !!u);
    return {
      id: r.id, bib: r.bibLabel, name: r.fullName, city: r.city, team: r.team, categoryId: r.categoryId, status: r.status,
      payment: r.paymentStatus, exempt: r.exempt, flags: r.flags, receiptUrls: urls,
      waConfirm: wa(confirmationMessage(r, event, cat, `${origin}/i/${r.accessToken}`)),
      waReminder: wa(paymentReminder(r, event, cat, r.flags, `${origin}/i/${r.accessToken}`)),
      kit: !!r.kitDeliveredAt, checkedInAt: r.checkedInAt,
    };
  }));

  const catStats = categories.map((c) => {
    const n = active.filter((r) => r.categoryId === c.id);
    return { c, athletes: n.length, paid: n.filter((r) => r.paymentStatus === "verified").length };
  });
  const low = catStats.filter((s) => s.athletes < s.c.minAthletes);
  const winners = draws.map((d) => {
    const r = regs.find((x) => x.id === d.registrationId);
    return { name: r?.fullName ?? "—", bib: r?.bibLabel ?? "—", prize: d.prizeLabel };
  });

  return (
    <main className="mx-auto max-w-5xl px-5 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/admin"><Logo /></Link>
        <div className="flex flex-wrap justify-end gap-2"><Link className="btn btn-dark btn-sm" href={`/admin/${slug}/largada`}>Lista de largada</Link><Link className="btn btn-line btn-sm" href={`/admin/${slug}/configurar`}>Configurar evento e categorias</Link><Link className="btn btn-line btn-sm" href={`/admin/${slug}/relatorio`}>Relatório para patrocinador</Link><LogoutButton /></div>
      </div>

      <section>
        <h1 className="display text-5xl">{event.name}</h1>
        <p className="text-muted">{event.eventDate.split("-").reverse().join("/")}{event.city ? ` · ${event.city}` : ""} · {event.registrationOpen ? "inscrições abertas" : "inscrições encerradas"}</p>
        <div className="mt-3"><EventControls slug={slug} open={event.registrationOpen} origin={origin} /></div>
      </section>

      {(!ai || ai.name === "mock" || repo.kind === "memory") && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950" role="note">
          {repo.kind === "memory" && <p><strong>Modo de teste:</strong> os dados estão só na memória e somem ao reiniciar.</p>}
          {ai?.name === "mock" && <p><strong>Modo simulado:</strong> a IA não está lendo comprovantes de verdade. Ela devolve o que a inscrição espera.</p>}
          {!ai && <p><strong>IA desligada:</strong> todo comprovante vai para a sua fila de conferência.</p>}
        </div>
      )}

      <section className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${event.hasKit ? "lg:grid-cols-7" : "lg:grid-cols-6"}`}>
        <StatCard label="Inscritos" value={String(active.length)} />
        <StatCard label="Pagos" value={String(paid.length)} />
        <StatCard label="Na fila" value={String(queue.length)} />
        <StatCard label="Presentes" value={String(active.filter((r) => r.checkedInAt).length)} />
        {event.hasKit && <StatCard label="Kits entregues" value={String(active.filter((r) => r.kitDeliveredAt).length)} />}
        <StatCard label="Arrecadado" value={formatBRLShort(money(paid))} wide />
      </section>
      <p className="hint -mt-4">Previsto com todos pagando: {formatBRLShort(money(active.filter((r) => !r.exempt)))}.{exempt.length > 0 && ` ${exempt.length} ${exempt.length === 1 ? "isento" : "isentos"} (organização), fora do faturamento.`}</p>

      {low.length > 0 && (
        <section className="card border-amber-300 p-5">
          <h2 className="display text-3xl">Categorias com poucos atletas</h2>
          <p className="hint">Abaixo do mínimo definido. Vale avisar o pessoal ou unificar com outra categoria.</p>
          <ul className="mt-2 flex flex-wrap gap-2">{low.map((s) => <li key={s.c.id} className="pill pill-warn">{s.c.name}: {s.athletes}/{s.c.minAthletes}</li>)}</ul>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><AssistedPanel slug={slug} ageRefDate={ageReference(event)} pixKey={event.pixKey} categories={categories} /></div>
        <RafflePanel slug={slug} winners={winners} />
        <div className="card p-5">
          <h3 className="display text-3xl">Por categoria</h3>
          <ul className="mt-2 divide-y divide-line">
            {catStats.map((s) => <li key={s.c.id} className="flex justify-between py-1.5"><span>{s.c.name}</span><span className="text-muted">{s.paid} pagos / {s.athletes}</span></li>)}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="display text-4xl mb-3">Inscritos</h2>
        <AdminTable rows={rows} hasKit={event.hasKit} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      </section>
    </main>
  );
}
