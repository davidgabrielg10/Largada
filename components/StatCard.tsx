/**
 * Cartão de número que não estoura: o corpo do número encolhe conforme a quantidade de
 * caracteres e a largura real do cartão (container query), sem JavaScript.
 * `wide` ocupa a linha inteira no celular e duas colunas no computador (valores em dinheiro são os mais longos).
 */
export function StatCard({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  const chars = Math.max(value.length, 3);
  return (
    <div className={`card p-4 ${wide ? "col-span-2 sm:col-span-1 lg:col-span-2" : ""}`}>
      <p className="hint truncate">{label}</p>
      <div className="[container-type:inline-size]">
        <p
          className="display whitespace-nowrap leading-none pt-1"
          style={{ fontSize: `min(2.5rem, calc(100cqw / ${(chars * 0.5).toFixed(2)}))` }}
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
