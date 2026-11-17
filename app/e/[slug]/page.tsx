import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { RegistrationForm } from "@/components/RegistrationForm";
import { getRepo } from "@/lib/repo";
import { ageReference } from "@/lib/rules";

export const dynamic = "force-dynamic";

const fmtDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const ev = await getRepo().getEventBySlug(slug);
  return { title: ev ? `Inscrição — ${ev.name}` : "Evento" };
}

export default async function EventPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  const repo = getRepo();
  const event = await repo.getEventBySlug(slug);
  if (!event) notFound();
  const categories = await repo.listCategories(event.id);

  return (
    <main>
      <header className="hero">
        <div className="mx-auto max-w-3xl px-5 pt-5 pb-12 sm:pb-16">
          <Logo light />
          <p className="mt-10 font-semibold text-red-300 first-letter:uppercase">{fmtDate(event.eventDate)}{event.city ? ` · ${event.city}` : ""}</p>
          <h1 className="display mt-2 text-5xl sm:text-7xl">{event.name}</h1>
          {event.description && <p className="mt-4 max-w-xl text-lg text-white/80">{event.description}</p>}
          {event.isDemo && <p className="pill pill-warn mt-4">Evento de demonstração — dados fictícios</p>}
        </div>
      </header>
      <section className="mx-auto -mt-6 max-w-3xl px-4 pb-16">
        {event.registrationOpen && categories.length > 0 ? (
          <RegistrationForm eventSlug={event.slug} ageRefDate={ageReference(event)} pixKey={event.pixKey} categories={categories} />
        ) : (
          <div className="card p-8 text-center">
            <p className="display text-4xl">Inscrições encerradas</p>
            <p className="mt-2 text-muted">Fale com a organização do evento se precisar de ajuda.</p>
          </div>
        )}
        <p className="hint mt-6 text-center">Sem login, sem aplicativo. Feito com <Link className="underline" href="/">Largada</Link>.</p>
      </section>
    </main>
  );
}
