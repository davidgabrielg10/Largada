/** Data e hora no fuso de Pernambuco, para qualquer tela (servidor ou navegador). */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit" });
}
