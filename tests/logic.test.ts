import { describe, expect, it } from "vitest";
import { formatBib, nameSimilarity, normalizePhone, toISODate, normalize } from "@/lib/text";
import { ageOn, categoryFlags, isPlausibleBirthDate, matchCategory, suggestCategory } from "@/lib/rules";
import { evaluateReceipt, replacePaymentFlags } from "@/lib/receipt";
import { buildSponsorReport } from "@/lib/report";
import { eligibleForRaffle, pickWinner } from "@/lib/raffle";
import { paymentReminder } from "@/lib/messages";
import type { ExtractedReceipt } from "@/lib/types";
import { CATEGORIES, EVENT, reg } from "./fixtures";

const byName = (n: string) => CATEGORIES.find((c) => c.name === n)!;

describe("texto", () => {
  it("normaliza acentos e símbolos", () => {
    expect(normalize("  São Vicente Férrer ")).toBe("sao vicente ferrer");
    expect(normalize("+50")).toBe("50");
  });

  it("numera com 3 dígitos e passa de 999 sem cortar", () => {
    expect(formatBib(1)).toBe("001");
    expect(formatBib(42)).toBe("042");
    expect(formatBib(999)).toBe("999");
    expect(formatBib(1000)).toBe("1000");
  });

  it("compara nomes ignorando acento, caixa e preposição", () => {
    expect(nameSimilarity("JOSÉ DA SILVA", "Jose Silva")).toBe(1);
    expect(nameSimilarity("Ana Souza", "Ana Maria de Souza")).toBe(1);
    expect(nameSimilarity("Ana Souza", "Carla Lima")).toBe(0);
    expect(nameSimilarity("J Silva", "José Silva")).toBe(1);
  });

  it("valida telefone brasileiro", () => {
    expect(normalizePhone("(81) 99999-0000")).toBe("81999990000");
    expect(normalizePhone("+55 81 99999-0000")).toBe("81999990000");
    expect(normalizePhone("999")).toBeNull();
  });

  it("converte datas", () => {
    expect(toISODate("21/03/1989")).toBe("1989-03-21");
    expect(toISODate("1989-03-21")).toBe("1989-03-21");
    expect(toISODate("31/02/1989")).toBeNull();
    expect(toISODate("lixo")).toBeNull();
  });
});

describe("regras de categoria", () => {
  it("calcula a idade na data do evento", () => {
    expect(ageOn("1976-12-20", "2026-12-20")).toBe(50);
    expect(ageOn("1976-12-21", "2026-12-20")).toBe(49);
  });

  it("barra data de nascimento absurda (o erro de 2026 da planilha)", () => {
    expect(isPlausibleBirthDate("2026-03-21", "2026-11-17")).toBe(false);
    expect(isPlausibleBirthDate("1910-01-01", "2026-11-17")).toBe(false);
    expect(isPlausibleBirthDate("1989-09-13", "2026-11-17")).toBe(true);
  });

  it("alerta idade fora da faixa", () => {
    expect(categoryFlags(byName("+50"), "1990-01-01", EVENT.eventDate, null)).toContain("age_out_of_range");
    expect(categoryFlags(byName("+50"), "1972-05-05", EVENT.eventDate, null)).toEqual([]);
    expect(categoryFlags(byName("+60"), "1960-12-20", EVENT.eventDate, null)).toEqual([]);
    expect(categoryFlags(byName("Iniciante"), "1990-01-01", EVENT.eventDate, null)).toEqual([]);
  });

  it("exige peso no Peso Pesado 95+", () => {
    const pp = byName("Peso Pesado 95+");
    expect(categoryFlags(pp, "1985-01-01", EVENT.eventDate, null)).toEqual(["weight_missing"]);
    expect(categoryFlags(pp, "1985-01-01", EVENT.eventDate, 88)).toEqual(["weight_below_min"]);
    expect(categoryFlags(pp, "1985-01-01", EVENT.eventDate, 101)).toEqual([]);
  });

  it("sugere categoria pela idade", () => {
    expect(suggestCategory(35, CATEGORIES)?.name).toBe("+30");
    expect(suggestCategory(72, CATEGORIES)?.name).toBe("+60");
    expect(suggestCategory(19, CATEGORIES)).toBeNull();
  });

  it("entende o jeito que as pessoas escrevem a categoria", () => {
    const m = (t: string) => matchCategory(t, CATEGORIES)?.name ?? null;
    expect(m("50+")).toBe("+50");
    expect(m("+50")).toBe("+50");
    expect(m("categoria 40 mais")).toBe("+40");
    expect(m("e-bike")).toBe("E-Bike");
    expect(m("ebike")).toBe("E-Bike");
    expect(m("feminino")).toBe("Feminino");
    expect(m("peso pesado")).toBe("Peso Pesado 95+");
    expect(m("INICIANTE / 1° COMPETIÇÃO (R$ 50,00)")).toBe("Iniciante");
    expect(m("")).toBeNull();
    expect(m("xyz")).toBeNull();
  });
});

const base: ExtractedReceipt = {
  isReceipt: true,
  amount: 80,
  payerName: "Carlos Eduardo Lima",
  receiverName: "Ritmo e Giro",
  paidAt: "2026-11-10T14:00:00Z",
  transactionId: "E123",
  bank: "Nubank",
  confidence: 0.95,
};
const NOW = new Date("2026-11-17T12:00:00Z");
const ev = (over: Partial<ExtractedReceipt> = {}, isDuplicate = false, expectedAmount = 80) =>
  evaluateReceipt({
    fullName: "Carlos Eduardo Lima",
    expectedAmount,
    extracted: { ...base, ...over },
    isDuplicate,
    now: NOW,
  });

describe("conferência de comprovante", () => {
  it("confere quando tudo bate", () => {
    expect(ev()).toEqual({ status: "verified", flags: [] });
  });

  it("aceita nome parcial do pagador", () => {
    expect(ev({ payerName: "CARLOS LIMA" }).status).toBe("verified");
  });

  it("valor menor é divergência; maior é revisão", () => {
    expect(ev({ amount: 50 })).toEqual({ status: "mismatch", flags: ["amount_low"] });
    expect(ev({ amount: 160 })).toEqual({ status: "review", flags: ["amount_high"] });
  });

  it("o Iniciante paga R$ 50", () => {
    expect(ev({ amount: 50 }, false, 50).status).toBe("verified");
    expect(ev({ amount: 80 }, false, 50).status).toBe("review");
  });

  it("pagador diferente vai para revisão (pode ser um parente)", () => {
    expect(ev({ payerName: "Maria das Dores" })).toEqual({ status: "review", flags: ["payer_name_mismatch"] });
  });

  it("comprovante repetido é divergência", () => {
    expect(ev({}, true)).toEqual({ status: "mismatch", flags: ["duplicate_receipt"] });
  });

  it("imagem que não é comprovante, baixa confiança e data futura vão para revisão", () => {
    expect(ev({ isReceipt: false }).flags).toEqual(["not_a_receipt"]);
    expect(ev({ confidence: 0.3 }).flags).toEqual(["low_confidence"]);
    expect(ev({ paidAt: "2026-12-30T10:00:00Z" }).flags).toEqual(["future_date"]);
    expect(ev({ amount: null }).flags).toEqual(["amount_unreadable"]);
  });

  it("sem resposta da IA, o organizador confere (nunca aprova sozinho)", () => {
    const r = evaluateReceipt({ fullName: "A B", expectedAmount: 80, extracted: null, isDuplicate: false, now: NOW });
    expect(r).toEqual({ status: "review", flags: ["ai_unavailable"] });
  });

  it("troca só os alertas de pagamento", () => {
    const flags = replacePaymentFlags(["age_out_of_range", "no_receipt", "duplicate_whatsapp"], ["amount_low"]);
    expect(flags.sort()).toEqual(["age_out_of_range", "amount_low", "duplicate_whatsapp"]);
  });
});

describe("relatório do patrocinador", () => {
  const regs = [
    reg({ id: "1", bibNumber: 1, city: "Carpina", team: "Pedal Canavial", categoryId: "c40", birthDate: "1980-05-01" }),
    reg({ id: "2", bibNumber: 2, city: "carpina ", team: "pedal canavial", categoryId: "c40", birthDate: "1982-05-01" }),
    reg({ id: "3", bibNumber: 3, city: "Paudalho", team: null, categoryId: "cin", birthDate: "2000-05-01", paymentStatus: "pending" }),
    reg({ id: "4", bibNumber: 4, city: "Paudalho", categoryId: "c60", birthDate: "1960-01-01", status: "cancelled" }),
  ];
  const prizes = [
    { categoryId: "c40", place: 1, amount: 200, isTrophy: false },
    { categoryId: "c40", place: 4, amount: null, isTrophy: true },
  ];
  const r = buildSponsorReport(EVENT, CATEGORIES, regs, prizes);

  it("ignora cancelados e junta grafias iguais", () => {
    expect(r.athletes).toBe(3);
    expect(r.citiesCount).toBe(2);
    expect(r.byCity[0]).toEqual({ name: "Carpina", count: 2 });
    expect(r.teamsCount).toBe(1);
  });

  it("soma o arrecadado conferido e o previsto", () => {
    expect(r.athletesPaid).toBe(2);
    expect(r.revenueVerified).toBe(160);
    expect(r.revenueExpected).toBe(210);
  });

  it("isento conta como atleta, mas fica fora do arrecadado e do previsto", () => {
    const comIsento = [...regs, reg({ id: "5", bibNumber: 5, categoryId: "c40", exempt: true })];
    const x = buildSponsorReport(EVENT, CATEGORIES, comIsento, prizes);
    expect(x.athletes).toBe(4);
    expect(x.revenueVerified).toBe(160);
    expect(x.revenueExpected).toBe(210);
  });

  it("conta premiação e faixas de idade", () => {
    expect(r.prizePool).toBe(200);
    expect(r.trophies).toBe(1);
    expect(r.ageBuckets.find((b) => b.name === "40 a 49")?.count).toBe(2);
  });
});

describe("sorteio e mensagens", () => {
  const regs = [
    reg({ id: "1", bibNumber: 1 }),
    reg({ id: "2", bibNumber: 2, paymentStatus: "pending" }),
    reg({ id: "3", bibNumber: 3, status: "cancelled" }),
    reg({ id: "4", bibNumber: 4 }),
  ];

  it("só concorre quem está ativo, pago e ainda não sorteado", () => {
    expect(eligibleForRaffle(regs, new Set()).map((r) => r.id)).toEqual(["1", "4"]);
    expect(eligibleForRaffle(regs, new Set(["1"])).map((r) => r.id)).toEqual(["4"]);
  });

  it("sorteia dentro da lista e devolve null se vazia", () => {
    expect(pickWinner(["a", "b", "c"], () => 1)).toBe("b");
    expect(pickWinner([])).toBeNull();
    for (let i = 0; i < 50; i++) expect(["x", "y"]).toContain(pickWinner(["x", "y"]));
  });

  it("monta a cobrança conforme o problema", () => {
    const r = reg({ id: "9", bibNumber: 9, fullName: "Carlos Eduardo Lima", flags: ["no_receipt"] });
    const txt = paymentReminder(r, { ...EVENT, pixKey: "chave@pix" }, byName("+40"));
    expect(txt).toContain("Carlos");
    expect(txt).toContain("009");
    expect(txt).toContain("chave@pix");
    expect(paymentReminder(r, EVENT, byName("+40"), ["amount_low"])).toContain("abaixo");
  });
});

describe("formatação de dinheiro para cartões", () => {
  it("sem centavos quando redondo", async () => {
    const { formatBRLShort } = await import("@/lib/text");
    expect(formatBRLShort(12400).replace(/\s/g, " ")).toBe("R$ 12.400");
    expect(formatBRLShort(49.9).replace(/\s/g, " ")).toBe("R$ 49,90");
  });
});
