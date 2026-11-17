import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryEditor, EventSettings, type CategoryView } from "@/components/EventConfig";
import { LoginForm, LogoutButton } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";
import { isAdmin } from "@/lib/auth";
import { toPrizeForm } from "@/lib/prizes";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurar evento" };

export default async function Configure({ params }: PageProps<"/admin/[slug]/configurar">) {
  const { slug } = await params;
  if (!(await isAdmin())) return <main className="mx-auto max-w-3xl px-5 py-6"><Link href="/"><Logo /></Link><LoginForm /></main>;
  const repo = getRepo();
  const event = await repo.getEventBySlug(slug);
  if (!event) notFound();
  const [cats, prizes, regs] = await Promise.all([repo.listCategories(event.id), repo.listPrizes(event.id), repo.listRegistrations(event.id)]);
  const views: CategoryView[] = cats.map((c) => ({
    ...c,
    athletes: regs.filter((r) => r.categoryId === c.id).length,
    prizes: toPrizeForm(prizes.filter((p) => p.categoryId === c.id)),
  }));
  return (
    <main className="mx-auto max-w-4xl px-5 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/admin"><Logo /></Link>
        <div className="flex gap-2"><Link href={`/admin/${slug}`} className="btn btn-line btn-sm">← Painel</Link><LogoutButton /></div>
      </div>
      <section>
        <h1 className="display text-5xl">Configurar evento</h1>
        <p className="text-muted">O endereço do formulário continua o mesmo: /e/{slug}</p>
      </section>
      <section className="space-y-3">
        <h2 className="display text-4xl">Dados do evento</h2>
        <EventSettings slug={slug} event={{
          name: event.name, eventDate: event.eventDate, city: event.city, description: event.description,
          pixKey: event.pixKey, basePrice: event.basePrice, ageRule: event.ageRule, hasKit: event.hasKit,
        }} />
      </section>
      <section className="space-y-3">
        <h2 className="display text-4xl">Categorias</h2>
        <p className="hint">Cada categoria tem suas regras. Quem se inscrever fora delas não é barrado: a inscrição entra com um alerta para você decidir. Ao mudar uma regra, os alertas dos inscritos são recalculados.</p>
        <CategoryEditor slug={slug} categories={views} basePrice={event.basePrice} />
      </section>
    </main>
  );
}
