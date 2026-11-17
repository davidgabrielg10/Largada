import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { PrintButton } from "@/components/PrintButton";
import { isAdmin } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { buildSponsorReport, type CountRow } from "@/lib/report";
import { formatBRL } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Relatório para patrocinador" };

function Bars({ title, rows, limit = 8 }: { title: string; rows: CountRow[]; limit?: number }) {
  const top = rows.slice(0, limit);
  const max = Math.max(1, ...top.map((r) => r.count));
  return (
    <div className="card p-5 break-inside-avoid">
      <h3 className="display text-3xl">{title}</h3>
      <ul className="mt-3 space-y-2">
        {top.map((r) => (
          <li key={r.name}>
            <div className="flex justify-between text-sm"><span>{r.name}</span><strong>{r.count}</strong></div>
            <div className="h-2 rounded-full bg-line"><div className="h-2 rounded-full bg-red" style={{ width: `${(r.count / max) * 100}%` }} /></div>
          </li>
        ))}
        {!top.length && <li className="text-muted">Sem dados ainda.</li>}
      </ul>
      {rows.length > limit && <p className="hint mt-2">+ {rows.length - limit} outros</p>}
    </div>
  );
}

export default async function Report({ params }: PageProps<"/admin/[slug]/relatorio">) {
  const { slug } = await params;
  if (!(await isAdmin())) return <main className="mx-auto max-w-3xl px-5 py-10"><p>Entre no <Link className="underline" href={`/admin/${slug}`}>painel</Link> primeiro.</p></main>;
  const repo = getRepo();
  const event = await repo.getEventBySlug(slug);
  if (!event) notFound();
  const [cats, regs, prizes] = await Promise.all([repo.listCategories(event.id), repo.listRegistrations(event.id), repo.listPrizes(event.id)]);
  const r = buildSponsorReport(event, cats, regs, prizes);

  return (
    <main className="mx-auto max-w-4xl px-5 py-6 space-y-6">
      <div className="flex items-center justify-between print:hidden"><Link href={`/admin/${slug}`} className="underline">← Painel</Link><PrintButton /></div>
      <header className="hero rounded-3xl p-8 print:text-black">
        <Logo light />
        <p className="mt-6 font-semibold text-red-300">Relatório de alcance</p>
        <h1 className="display text-5xl sm:text-6xl">{r.eventName}</h1>
        <p className="mt-1 text-white/70">{r.eventDate.split("-").reverse().join("/")}{r.city ? ` · ${r.city}` : ""}</p>
      </header>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[[r.athletes, "atletas inscritos"], [r.citiesCount, "cidades de origem"], [r.teamsCount, "equipes"], [formatBRL(r.prizePool), "em premiação"]].map(([v, l]) => (
          <div key={String(l)} className="card p-4"><p className="display text-5xl text-red">{v}</p><p className="hint">{l}</p></div>
        ))}
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <Bars title="Cidades" rows={r.byCity} />
        <Bars title="Equipes" rows={r.byTeam} />
        <Bars title="Categorias" rows={r.byCategory} />
        <Bars title="Faixa etária" rows={r.ageBuckets} limit={10} />
      </section>
      <p className="hint">{r.trophies} troféus. Atletas pagos e conferidos: {r.athletesPaid}. Dados do sistema de inscrição da Largada, apenas inscrições ativas.</p>
    </main>
  );
}
