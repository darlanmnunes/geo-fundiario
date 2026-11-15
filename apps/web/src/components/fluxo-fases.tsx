"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Clock, ExternalLink, UserRound } from "lucide-react";
import { Etiqueta, classeBotao } from "./ui";
import { FASES, NORMAS } from "@/lib/dominio";

/** As dez fases como trilha clicável: escolher uma mostra o que se faz, quem faz, o prazo, as entregas e a lei. */
export function FluxoFases() {
  const [i, setI] = useState(0);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const f = FASES[i];
  const ir = (n: number) => {
    const alvo = Math.max(0, Math.min(FASES.length - 1, n));
    setI(alvo);
    botoes.current[alvo]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Fases do processo de REURB" className="flex overflow-x-auto border-b border-borda"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); ir(i + 1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); ir(i - 1); }
          if (e.key === "Home") { e.preventDefault(); ir(0); }
          if (e.key === "End") { e.preventDefault(); ir(FASES.length - 1); }
        }}>
        {FASES.map((x, n) => (
          <button key={x.codigo} ref={(el) => { botoes.current[n] = el; }} type="button" role="tab" id={`aba-${x.codigo}`} aria-selected={n === i} aria-controls="painel-fase" tabIndex={n === i ? 0 : -1} onClick={() => setI(n)}
            className={clsx("group relative flex min-w-[104px] flex-1 flex-col items-center gap-1 px-1.5 pt-3 pb-2.5 text-center", n === i ? "bg-azul-claro" : "hover:bg-realce")}>
            {/* linha que liga os passos */}
            {n > 0 && <span aria-hidden className={clsx("absolute top-[25px] right-1/2 left-[-50%] h-0.5", n <= i ? "bg-azul" : "bg-borda-forte")} />}
            <span className={clsx("num relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-[13px] font-bold", n === i ? "border-azul bg-azul text-white" : n < i ? "border-azul bg-superficie text-azul" : "border-borda-forte bg-superficie text-texto-2")}>{n + 1}</span>
            <span className={clsx("text-[12.5px] leading-tight", n === i ? "font-semibold text-azul-escuro" : "text-texto-2")}>{x.curto}</span>
            {n === i && <span aria-hidden className="absolute inset-x-0 bottom-[-1px] h-[3px] bg-azul" />}
          </button>
        ))}
      </div>

      <div id="painel-fase" role="tabpanel" aria-labelledby={`aba-${f.codigo}`} className="grid gap-x-8 gap-y-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] leading-tight font-semibold">{i + 1}. {f.nome}</h3>
            <Etiqueta tom={f.tipo === "legal" ? "azul" : "neutro"}>{f.tipo === "legal" ? "Fase prevista em lei" : "Etapa técnica de apoio"}</Etiqueta>
          </div>
          <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-texto-2">{f.descricao}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex gap-2">
              <UserRound className="mt-0.5 size-4 shrink-0 text-texto-3" aria-hidden />
              <div><dt className="text-[12.5px] text-texto-3">Quem conduz</dt><dd className="text-[14px]">{f.quem}</dd></div>
            </div>
            <div className="flex gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-texto-3" aria-hidden />
              <div>
                <dt className="text-[12.5px] text-texto-3">Prazo legal</dt>
                <dd className="text-[14px]">{f.prazoDias ? <><b>{f.prazoDias} dias</b>. {f.prazoNota}</> : (f.prazoNota ?? "Sem prazo fixado em lei")}</dd>
              </div>
            </div>
          </dl>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => ir(i - 1)} disabled={i === 0} className={classeBotao("secundario")}><ChevronLeft className="size-4" aria-hidden /> Fase anterior</button>
            <button type="button" onClick={() => ir(i + 1)} disabled={i === FASES.length - 1} className={classeBotao("secundario")}>Próxima fase <ChevronRight className="size-4" aria-hidden /></button>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="text-[13px] font-semibold">O que sai desta fase</h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13.5px] text-texto-2">
              {f.entregas.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
          <div>
            <h4 className="text-[13px] font-semibold">Base legal e normas</h4>
            <ul className="mt-1 space-y-1 text-[13.5px]">
              {f.base.map((b) => (
                <li key={b.norma + (b.trecho ?? "")}>
                  <a href={NORMAS[b.norma].url} target="_blank" rel="noreferrer" className="inline-flex items-baseline gap-1 text-azul hover:underline">
                    {NORMAS[b.norma].rotulo}<ExternalLink className="size-3 translate-y-px" aria-label="(abre em nova aba)" />
                  </a>
                  {b.trecho && <span className="text-texto-2">, {b.trecho}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
