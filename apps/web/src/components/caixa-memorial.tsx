"use client";

import { useState } from "react";
import { Check, Copy, Download, FileText } from "lucide-react";
import { baixarBlob, memorialDocx } from "@/lib/arquivos";
import { classeBotao } from "./ui";

/** Memorial em folha de documento: quadro do imóvel, descrição e fecho, como na peça impressa. */
export function CaixaMemorial({ texto, arquivo }: { texto: string; arquivo: string }) {
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setErro(false);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setErro(true);
    }
  };
  const baixar = () => {
    const url = URL.createObjectURL(new Blob(["﻿" + texto], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${arquivo}.txt` });
    a.click();
    URL.revokeObjectURL(url);
  };
  const blocos = texto.split("\n\n");
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={async () => baixarBlob(`${arquivo}.docx`, await memorialDocx(texto))} className={classeBotao("primario")}>
          <FileText className="size-4" aria-hidden /> Baixar em Word (.docx)
        </button>
        <button type="button" onClick={copiar} className={classeBotao("secundario")}>
          {copiado ? <Check className="size-4 text-verde" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copiado ? "Copiado" : "Copiar texto"}
        </button>
        <button type="button" onClick={baixar} className={classeBotao("secundario")}>
          <Download className="size-4" aria-hidden /> Baixar .txt
        </button>
        {erro && <span role="alert" className="text-[13px] text-vermelho">O navegador bloqueou a cópia. Use Baixar .txt.</span>}
      </div>
      <article className="max-h-[560px] overflow-auto rounded border border-borda bg-white px-6 py-5 text-[14px] leading-relaxed text-texto sm:px-10">
        {blocos.map((b, i) => {
          if (b === "MEMORIAL DESCRITIVO") return <h3 key={i} className="mb-4 text-center text-[16px] font-bold tracking-wide">{b}</h3>;
          if (b === "DESCRIÇÃO DO PERÍMETRO" || b === "INFORMAÇÕES ADICIONAIS") return <h4 key={i} className="mt-5 mb-2 text-[14px] font-bold">{b}</h4>;
          if (b.startsWith("IMÓVEL:")) {
            return (
              <dl key={i} className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 border-y border-borda py-2.5">
                {b.split("\n").map((l) => {
                  const [k, ...v] = l.split(": ");
                  return <div key={k} className="contents"><dt className="font-semibold">{k}:</dt><dd className="num">{v.join(": ")}</dd></div>;
                })}
              </dl>
            );
          }
          if (b.startsWith("Inicia-se")) return <p key={i} className="num max-w-[78ch] text-justify hyphens-auto [text-indent:2.5em]">{b}</p>;
          return <p key={i} className="mt-3 max-w-[78ch] whitespace-pre-line">{b}</p>;
        })}
      </article>
    </div>
  );
}
