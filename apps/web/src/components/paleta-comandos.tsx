"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CornerDownLeft, FileText, LandPlot, Map, Scale, User } from "lucide-react";

export interface ItemBusca {
  tipo: "pagina" | "projeto" | "lote" | "pessoa" | "fase" | "documento";
  titulo: string;
  detalhe?: string;
  href: string;
  /** texto normalizado para busca, sem acentos */
  chave: string;
}

const ICONE = { pagina: Map, projeto: LandPlot, lote: LandPlot, pessoa: User, fase: Scale, documento: FileText };
const ROTULO = { pagina: "Página", projeto: "Núcleo", lote: "Lote", pessoa: "Ocupante", fase: "Fase", documento: "Documento" };

export function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function PaletaComandos({ itens }: { itens: ItemBusca[] }) {
  const [aberta, setAberta] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  void input;
  const router = useRouter();

  useEffect(() => {
    const limpar = () => {
      setQ("");
      setIdx(0);
    };
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        limpar();
        setAberta((v) => !v);
      } else if (e.key === "Escape") setAberta(false);
    };
    const abrir = () => {
      limpar();
      setAberta(true);
    };
    window.addEventListener("keydown", tecla);
    window.addEventListener("geof:paleta", abrir);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("geof:paleta", abrir);
    };
  }, []);

  const resultados = useMemo(() => {
    const termos = normalizar(q).split(/\s+/).filter(Boolean);
    const base = termos.length ? itens.filter((i) => termos.every((t) => i.chave.includes(t))) : itens.filter((i) => i.tipo === "pagina" || i.tipo === "projeto");
    return base.slice(0, 12);
  }, [q, itens]);

  const ir = (item?: ItemBusca) => {
    if (!item) return;
    setAberta(false);
    router.push(item.href);
  };

  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-tinta-900/40 px-4 pt-[12vh] backdrop-blur-[2px]" onClick={() => setAberta(false)} role="dialog" aria-modal="true" aria-label="Busca e comandos">
      <div className="painel surgir w-full max-w-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, resultados.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter") ir(resultados[idx]);
          }}
          placeholder="Digite um lote (Q03-L08), um nome, uma fase ou um documento"
          className="w-full border-b fio bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-tinta-300"
        />
        <ul className="max-h-[52vh] overflow-y-auto py-1">
          {resultados.map((r, i) => {
            const Icone = ICONE[r.tipo];
            return (
              <li key={r.href + r.titulo}>
                <button
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => ir(r)}
                  className={clsx("flex w-full items-center gap-3 px-4 py-2 text-left", i === idx ? "bg-terra-100/60" : "hover:bg-papel-100")}
                >
                  <Icone className="size-4 shrink-0 text-tinta-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-tinta-900">{r.titulo}</span>
                    {r.detalhe && <span className="block truncate text-[12px] text-tinta-500">{r.detalhe}</span>}
                  </span>
                  <span className="rotulo">{ROTULO[r.tipo]}</span>
                  {i === idx && <CornerDownLeft className="size-3.5 text-tinta-300" />}
                </button>
              </li>
            );
          })}
          {!resultados.length && <li className="px-4 py-6 text-center text-[13px] text-tinta-500">Nada encontrado para “{q}”.</li>}
        </ul>
        <div className="flex items-center gap-3 border-t fio px-4 py-1.5 text-[11px] text-tinta-500">
          <span><kbd className="mono">↑↓</kbd> navegar</span>
          <span><kbd className="mono">↵</kbd> abrir</span>
          <span><kbd className="mono">esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
