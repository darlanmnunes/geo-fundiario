"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const ABAS = [
  { sufixo: "", rotulo: "Mapa e processo" },
  { sufixo: "/lotes", rotulo: "Cadastro" },
  { sufixo: "/levantamento", rotulo: "Levantamento" },
  { sufixo: "/notificacoes", rotulo: "Notificações" },
  { sufixo: "/documentos", rotulo: "Documentos e peças" },
];

export function AbasProjeto() {
  const caminho = usePathname().replace(/\/$/, "");
  const base = caminho.split("/").slice(0, 3).join("/");
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Seções do núcleo">
      {ABAS.map((a) => {
        const href = base + a.sufixo;
        const ativa = a.sufixo === "" ? caminho === base : caminho.startsWith(href);
        return (
          <Link key={a.sufixo} href={href} aria-current={ativa ? "page" : undefined}
            className={clsx("border-b-[3px] px-3 py-2 text-[14px] whitespace-nowrap transition-colors", ativa ? "border-azul font-semibold text-azul" : "border-transparent text-texto-2 hover:border-borda-forte hover:text-texto")}>
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
