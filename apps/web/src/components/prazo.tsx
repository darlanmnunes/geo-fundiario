"use client";

import { useSyncExternalStore } from "react";
import { Etiqueta } from "./ui";

// "Hoje" só existe no navegador; no servidor o componente mostra a data fixa.
const assinarNada = () => () => {};
const hojeNoCliente = () => new Date().toISOString().slice(0, 10);
const hojeNoServidor = () => null;

export function diasAte(iso: string, hoje: string) {
  return Math.round((Date.parse(iso) - Date.parse(hoje)) / 86_400_000);
}

export function Prazo({ data, encerrado = false, compacto = false }: { data: string; encerrado?: boolean; compacto?: boolean }) {
  const hoje = useSyncExternalStore(assinarNada, hojeNoCliente, hojeNoServidor);
  const dataBr = new Date(data + "T12:00:00").toLocaleDateString("pt-BR");
  if (!hoje || encerrado) return <span className="num text-texto-2">{dataBr}</span>;
  const dias = diasAte(data, hoje);
  const texto = dias < 0 ? `vencido há ${-dias} dia${dias === -1 ? "" : "s"}` : dias === 0 ? "vence hoje" : `faltam ${dias} dia${dias === 1 ? "" : "s"}`;
  return (
    <span className="num inline-flex flex-wrap items-center gap-1.5">
      {!compacto && <span className="text-texto-2">{dataBr}</span>}
      <Etiqueta tom={dias < 0 ? "vermelho" : dias <= 7 ? "vermelho" : dias <= 30 ? "ambar" : "verde"}>{texto}</Etiqueta>
    </span>
  );
}
