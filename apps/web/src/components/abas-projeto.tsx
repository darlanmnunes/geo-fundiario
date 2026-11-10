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
  const caminho = usePathname();
  const base = caminho.split("/").slice(0, 3).join("/");
  return (
    <nav className="-mb-px flex gap-5 overflow-x-auto" aria-label="Seções do núcleo">
      {ABAS.map((a) => {
        const href = base + a.sufixo;
        const ativoFinal = a.sufixo === "" ? caminho === base : caminho.startsWith(href);
        return (
          <Link
            key={a.sufixo}
            href={href}
            className={clsx(
              "border-b-2 py-2 text-[13px] whitespace-nowrap transition-colors",
              ativoFinal ? "border-terra-600 font-medium text-tinta-900" : "border-transparent text-tinta-500 hover:text-tinta-900",
            )}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
