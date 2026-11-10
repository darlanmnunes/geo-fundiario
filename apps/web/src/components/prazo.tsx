"use client";

import { useSyncExternalStore } from "react";
import clsx from "clsx";

// "Hoje" só existe no navegador; no servidor o componente renderiza a data fixa.
const assinarNada = () => () => {};
const hojeNoCliente = () => new Date().toISOString().slice(0, 10);
const hojeNoServidor = () => null;

export function diasAte(iso: string, hoje: string) {
  return Math.round((Date.parse(iso) - Date.parse(hoje)) / 86_400_000);
}

export function Prazo({ data, encerrado = false, compacto = false }: { data: string; encerrado?: boolean; compacto?: boolean }) {
  const hoje = useSyncExternalStore(assinarNada, hojeNoCliente, hojeNoServidor);
  const dataBr = new Date(data + "T12:00:00").toLocaleDateString("pt-BR");
  if (!hoje || encerrado) return <span className="tab text-tinta-700">{dataBr}</span>;
  const dias = diasAte(data, hoje);
  const texto = dias < 0 ? `venceu há ${-dias} d` : dias === 0 ? "vence hoje" : `${dias} d`;
  return (
    <span className="tab inline-flex items-center gap-1.5">
      {!compacto && <span className="text-tinta-700">{dataBr}</span>}
      <span
        className={clsx(
          "carimbo",
          dias < 0 ? "text-tinta-500" : dias <= 7 ? "text-carimbo-600" : dias <= 30 ? "text-ocre-700" : "text-oliva-700",
        )}
      >
        {texto}
      </span>
    </span>
  );
}
