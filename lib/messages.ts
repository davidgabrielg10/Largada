import type { Category, EventRow, Flag, Registration } from "./types";
import { formatBRL } from "./text";

function brDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

/** Texto de confirmação, pronto para colar no WhatsApp. */
export function confirmationMessage(reg: Registration, event: EventRow, category: Category, fichaUrl?: string): string {
  const lines = [
    `Olá, ${firstName(reg.fullName)}! Sua inscrição no ${event.name} foi recebida.`,
    ``,
    `Seu número: ${reg.bibLabel}`,
    `Categoria: ${category.name}`,
    `Data: ${brDate(event.eventDate)}${event.city ? ` · ${event.city}` : ""}`,
    ``,
    `Guarde este número: ele identifica você na prova e nos sorteios.`,
  ];
  if (fichaUrl) lines.push(``, `Sua ficha (mostre o QR na entrada do evento): ${fichaUrl}`);
  return lines.join("\n");
}

/** Cobrança educada para quem ainda não pagou ou cujo comprovante deu problema. */
export function paymentReminder(reg: Registration, event: EventRow, category: Category, flags: Flag[] = reg.flags, fichaUrl?: string): string {
  const lines = [`Olá, ${firstName(reg.fullName)}! Tudo bem? Aqui é da organização do ${event.name}.`, ``];

  if (flags.includes("amount_low")) {
    lines.push(
      `Recebemos seu comprovante, mas o valor ficou abaixo da inscrição da categoria ${category.name} (${formatBRL(category.price)}).`,
      `Pode nos enviar o complemento ou o comprovante correto?`,
    );
  } else if (flags.includes("duplicate_receipt")) {
    lines.push(
      `Esse comprovante já aparece em outra inscrição. Pode nos enviar o comprovante do seu pagamento?`,
    );
  } else if (flags.includes("no_receipt") || flags.length === 0) {
    lines.push(
      `Sua inscrição (nº ${reg.bibLabel}, categoria ${category.name}) está reservada, mas ainda não encontramos o comprovante do Pix de ${formatBRL(category.price)}.`,
      `Pode nos enviar por aqui?`,
    );
  } else {
    lines.push(
      `Estamos conferindo o comprovante da sua inscrição (nº ${reg.bibLabel}) e precisamos confirmar um detalhe. Pode nos enviar uma foto mais nítida do comprovante?`,
    );
  }

  if (event.pixKey) lines.push(``, `Chave Pix: ${event.pixKey}`);
  if (fichaUrl) lines.push(``, `Você também pode enviar o comprovante pela sua ficha: ${fichaUrl}`);
  lines.push(``, `Obrigado!`);
  return lines.join("\n");
}
