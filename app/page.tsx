import Link from "next/link";
import { Logo } from "@/components/Logo";

const STEPS = [
  ["1", "Link no WhatsApp", "O atleta abre o link, preenche e paga no Pix. Sem app, sem login, sem QR."],
  ["2", "A IA lê o comprovante", "Valor, nome e data saem da foto. O código confere com a inscrição e levanta os alertas."],
  ["3", "Você só decide o que importa", "Tudo certo: aprovado. Dúvida: fica na sua fila com o motivo escrito."],
];
const EXTRAS = [
  "Número de atleta de 3 dígitos por ordem de inscrição, nunca repetido",
  "Alerta de idade fora da categoria e de peso mínimo",
  "Aviso de categoria com poucos atletas para unificar",
  "Inscrição assistida: cole o texto ou a foto de uma mensagem de WhatsApp",
  "Sorteio entre quem pagou",
  "Relatório pronto para patrocinador: cidades, equipes e categorias",
];

export default function Home() {
  return (
    <main>
      <header className="hero">
        <div className="mx-auto max-w-5xl px-5 pt-5 pb-16 sm:pb-24">
          <div className="flex items-center justify-between">
            <Logo light />
            <Link href="/admin" className="btn btn-sm border-white/40 text-white hover:bg-white hover:text-ink">Sou organizador</Link>
          </div>
          <h1 className="display mt-14 max-w-3xl text-6xl sm:text-8xl">Inscrição de evento esportivo, sem dor de cabeça.</h1>
          <p className="mt-5 max-w-2xl text-xl text-white/80">
            Para quem organiza prova de comunidade e não precisa (nem quer) pagar taxa de plataforma grande. Um link, o Pix na hora, a conferência feita por IA.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/e/rachao-nazare" className="btn btn-red text-lg">Ver o formulário de exemplo</Link>
            <Link href="/admin" className="btn border-white/40 text-white hover:bg-white hover:text-ink">Entrar no painel</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="display text-4xl sm:text-5xl">Como funciona</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map(([n, t, d]) => (
            <div key={n} className="card p-6">
              <p className="display text-6xl text-red">{n}</p>
              <p className="mt-1 text-xl font-bold">{t}</p>
              <p className="mt-1 text-muted">{d}</p>
            </div>
          ))}
        </div>
        <h2 className="display mt-14 text-4xl sm:text-5xl">O que já vem pronto</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {EXTRAS.map((x) => <li key={x} className="card flex gap-3 p-4"><span className="text-red font-bold">✓</span>{x}</li>)}
        </ul>
        <p className="hint mt-10">A IA só lê o comprovante. Quem decide é regra de código, e na dúvida a inscrição vai para a sua fila. Nada é aprovado sem leitura.</p>
      </section>
    </main>
  );
}
