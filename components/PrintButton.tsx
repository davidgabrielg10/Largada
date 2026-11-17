"use client";
export function PrintButton() {
  return <button className="btn btn-dark btn-sm" onClick={() => window.print()}>Imprimir / salvar PDF</button>;
}
