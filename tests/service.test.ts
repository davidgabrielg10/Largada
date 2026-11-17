import { beforeEach, describe, expect, it } from "vitest";
import { register, adminAction, changeCategory, draftFromMessage, ServiceError } from "@/lib/service";
import { getRepo } from "@/lib/repo";
import { tokenIsValid, makeToken } from "@/lib/auth";
import { allow } from "@/lib/ratelimit";

const g = globalThis as unknown as { __largadaRepo?: unknown };
const img = (n: number) => ({ bytes: new Uint8Array([1, 2, 3, n]), mimeType: "image/png" });
const base = (over = {}) => ({
  eventSlug: "rachao-nazare", categoryId: "cat-3", fullName: "Teste da Silva", whatsapp: "(81) 98888-7777",
  birthDate: "1980-05-10", termsAccepted: true, ...over,
});

beforeEach(() => {
  g.__largadaRepo = undefined;
  process.env.AI_MODE = "mock";
  process.env.ADMIN_PIN = "1234";
});

describe("pipeline de inscrição", () => {
  it("com comprovante coerente: verificada e com número sequencial", async () => {
    const { registration } = await register(base({ file: img(1) }));
    expect(registration.paymentStatus).toBe("verified");
    expect(registration.bibNumber).toBe(9); // 8 do demo + 1
    expect(registration.bibLabel).toBe("009");
  });

  it("sem comprovante: pendente com alerta", async () => {
    const { registration } = await register(base());
    expect(registration.paymentStatus).toBe("pending");
    expect(registration.flags).toContain("no_receipt");
  });

  it("mesmo arquivo em outra inscrição: divergente por duplicidade", async () => {
    await register(base({ file: img(7) }));
    const { registration } = await register(base({ fullName: "Outro Nome Completo", whatsapp: "81977776666", file: img(7) }));
    expect(registration.paymentStatus).toBe("mismatch");
    expect(registration.flags).toContain("duplicate_receipt");
  });

  it("IA desligada: vai para conferência, nunca aprova sozinha", async () => {
    process.env.AI_MODE = "off";
    const { registration } = await register(base({ file: img(2) }));
    expect(registration.paymentStatus).toBe("review");
    expect(registration.flags).toContain("ai_unavailable");
  });

  it("WhatsApp repetido e idade fora da categoria geram alertas", async () => {
    await register(base());
    const { registration } = await register(base({ fullName: "Segundo Cadastro", birthDate: "2000-01-01" }));
    expect(registration.flags).toContain("duplicate_whatsapp");
    expect(registration.flags).toContain("age_out_of_range");
  });

  it("rejeita data de nascimento impossível e arquivo inválido", async () => {
    await expect(register(base({ birthDate: "2026-01-01" }))).rejects.toThrow(ServiceError);
    await expect(register(base({ file: { bytes: new Uint8Array([1]), mimeType: "text/html" } }))).rejects.toThrow(ServiceError);
  });

  it("inscrição encerrada bloqueia o link, mas não o cadastro assistido", async () => {
    const repo = getRepo();
    const ev = (await repo.listEvents())[0];
    await repo.setRegistrationOpen(ev.id, false);
    await expect(register(base())).rejects.toThrow(/encerradas/);
    await expect(register(base({ source: "assisted" }))).resolves.toBeTruthy();
  });
});

describe("ações do organizador", () => {
  it("aprovar limpa só os alertas de pagamento", async () => {
    const { registration } = await register(base({ birthDate: "2000-01-01" }));
    const r = await adminAction(registration.id, "approve");
    expect(r.paymentStatus).toBe("verified");
    expect(r.flags).toContain("age_out_of_range");
    expect(r.flags).not.toContain("no_receipt");
  });

  it("trocar categoria recalcula alertas de idade", async () => {
    const { registration } = await register(base({ categoryId: "cat-1" })); // +20, mas nasceu em 1980
    expect(registration.flags).toContain("age_out_of_range");
    const r = await changeCategory(registration.id, "cat-3");
    expect(r.flags).not.toContain("age_out_of_range");
  });

  it("cancelar mantém o número reservado (nunca reaproveita)", async () => {
    const a = await register(base());
    await adminAction(a.registration.id, "cancel");
    const b = await register(base({ fullName: "Depois Dele", whatsapp: "81966665555" }));
    expect(b.registration.bibNumber).toBe(a.registration.bibNumber + 1);
  });
});

describe("cadastro assistido (simulado)", () => {
  it("extrai campos de mensagem solta e sugere categoria", async () => {
    const r = await draftFromMessage("rachao-nazare", {
      text: "Nome: Zé da Bike\nCidade: Carpina\nEquipe: Pedal X\nCategoria: +50\nNascimento: 12/03/1972\nWhatsApp: 81 99999-1234",
    });
    expect(r.draft?.birthDate).toBe("1972-03-12");
    expect(r.category?.name).toBe("+50");
  });
});

describe("auth e limite", () => {
  it("token válido, adulterado e vencido", () => {
    const t = makeToken();
    expect(tokenIsValid(t)).toBe(true);
    expect(tokenIsValid(t.slice(0, -1) + (t.endsWith("0") ? "1" : "0"))).toBe(false); // troca o último caractere de verdade
    expect(tokenIsValid(makeToken(Date.now() - 8 * 24 * 3600 * 1000))).toBe(false);
    expect(tokenIsValid(undefined)).toBe(false);
  });
  it("limite por janela", () => {
    const k = "t" + Math.random();
    expect([1, 2, 3].map(() => allow(k, 2, 1000, 0))).toEqual([true, true, false]);
    expect(allow(k, 2, 1000, 2000)).toBe(true);
  });
});
