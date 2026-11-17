import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckinList, type ListGroup } from "@/components/CheckinList";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";
import { isAdmin } from "@/lib/auth";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lista de largada" };

export default async function StartList({ params }: PageProps<"/admin/[slug]/largada">) {
  const { slug } = await params;
  if (!(await isAdmin())) return <main className="mx-auto max-w-3xl px-5 py-6"><Link href="/"><Logo /></Link><LoginForm /></main>;
  const repo = getRepo();
  const event = await repo.getEventBySlug(slug);
  if (!event) notFound();
  const [cats, regs] = await Promise.all([repo.listCategories(event.id), repo.listRegistrations(event.id)]);
  const active = regs.filter((r) => r.status === "active");
  const groups: ListGroup[] = cats.map((c) => ({
    id: c.id, name: c.name,
    rows: active.filter((r) => r.categoryId === c.id).sort((a, b) => a.bibNumber - b.bibNumber).map((r) => ({
      id: r.id, bib: r.bibLabel, name: r.fullName, city: r.city, team: r.team, payment: r.paymentStatus, checkedInAt: r.checkedInAt, kitAt: r.kitDeliveredAt,
    })),
  })).filter((g) => g.rows.length > 0);

  return (
    <main className="mx-auto max-w-4xl px-5 py-6 print:max-w-none print:px-0 print:py-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/admin"><Logo /></Link>
        <Link href={`/admin/${slug}`} className="btn btn-line btn-sm">← Painel</Link>
      </div>
      <h1 className="display text-5xl print:text-3xl">Lista de largada</h1>
      <p className="mb-4 text-muted">{event.name} · {event.eventDate.split("-").reverse().join("/")}{event.city ? ` · ${event.city}` : ""}</p>
      <CheckinList groups={groups} hasKit={event.hasKit} />
    </main>
  );
}
