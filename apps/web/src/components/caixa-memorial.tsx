"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

export function CaixaMemorial({ texto, arquivo }: { texto: string; arquivo: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };
  const baixar = () => {
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: arquivo });
    a.click();
    URL.revokeObjectURL(url);
  };
  const botao = "flex items-center gap-1.5 rounded border px-2.5 py-1 text-[12px] font-medium";
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button onClick={copiar} className={`${botao} fio-forte text-tinta-700 hover:bg-papel-100`}>
          {copiado ? <Check className="size-3.5 text-oliva-700" /> : <Copy className="size-3.5" />} {copiado ? "Copiado" : "Copiar"}
        </button>
        <button onClick={baixar} className={`${botao} border-tinta-900 bg-tinta-900 text-papel-50 hover:bg-tinta-700`}>
          <Download className="size-3.5" /> Baixar .txt
        </button>
      </div>
      <pre className="max-h-[480px] overflow-auto rounded border fio bg-papel-50 p-4 font-serif text-[13.5px] leading-relaxed whitespace-pre-wrap text-tinta-900">{texto}</pre>
    </div>
  );
}
