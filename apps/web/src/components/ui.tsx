import clsx from "clsx";
import type { ReactNode } from "react";
import type { Tom } from "@/lib/dominio";

/** Superfície branca com borda. `titulo` vai no cabeçalho; `aside` à direita dele. */
export function Painel({ titulo, aside, children, className, corpo, id }: { titulo?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; corpo?: string; id?: string }) {
  return (
    <section id={id} className={clsx("painel", className)}>
      {titulo && (
        <header>
          <h2 className="text-[14px] font-semibold text-texto">{titulo}</h2>
          {aside && <div className="text-[12.5px] text-texto-3">{aside}</div>}
        </header>
      )}
      <div className={corpo ?? "p-3.5"}>{children}</div>
    </section>
  );
}

export function Rotulo({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx("block text-[12px] text-texto-3", className)}>{children}</span>;
}

/** Par rótulo/valor de ficha. */
export function Dado({ rotulo, children, cod = false, className }: { rotulo: ReactNode; children: ReactNode; cod?: boolean; className?: string }) {
  return (
    <div className={clsx("min-w-0", className)}>
      <Rotulo>{rotulo}</Rotulo>
      <div className={clsx("mt-0.5 text-[14px] text-texto", cod && "cod")}>{children}</div>
    </div>
  );
}

const TEXTO_TOM: Record<Tom, string> = { neutro: "text-texto", azul: "text-azul", verde: "text-verde", ambar: "text-ambar", vermelho: "text-vermelho", roxo: "text-roxo" };

/** Indicador: valor com rótulo acima e nota abaixo. Usado em faixas, nunca como cartão solto. */
export function Indicador({ rotulo, valor, nota, tom = "neutro" }: { rotulo: ReactNode; valor: ReactNode; nota?: ReactNode; tom?: Tom }) {
  return (
    <div className="min-w-0 px-3.5 py-2.5">
      <Rotulo className="truncate">{rotulo}</Rotulo>
      <div className={clsx("num mt-0.5 text-[22px] leading-tight font-semibold", TEXTO_TOM[tom])}>{valor}</div>
      {nota && <div className="mt-0.5 truncate text-[12px] text-texto-3">{nota}</div>}
    </div>
  );
}

/** Faixa de indicadores separados por fios: uma superfície só. */
export function FaixaIndicadores({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("painel grid divide-borda max-md:divide-y md:divide-x", className)}>{children}</div>;
}

const FUNDO_TOM: Record<Tom, string> = {
  neutro: "bg-realce text-texto-2 ring-1 ring-inset ring-borda",
  azul: "bg-azul-claro text-azul-escuro",
  verde: "bg-verde-claro text-verde",
  ambar: "bg-ambar-claro text-ambar",
  vermelho: "bg-vermelho-claro text-vermelho",
  roxo: "bg-roxo-claro text-roxo",
};

export function Etiqueta({ children, tom = "neutro", className }: { children: ReactNode; tom?: Tom; className?: string }) {
  return <span className={clsx("etiqueta", FUNDO_TOM[tom], className)}>{children}</span>;
}

export function Ponto({ cor, className }: { cor: string; className?: string }) {
  return <span aria-hidden className={clsx("inline-block size-2.5 shrink-0 rounded-[2px]", className)} style={{ background: cor }} />;
}

export function Cabecalho({ titulo, descricao, acoes }: { titulo: ReactNode; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-semibold text-texto">{titulo}</h1>
        {descricao && <p className="mt-1 max-w-[75ch] text-[14px] leading-relaxed text-texto-2">{descricao}</p>}
      </div>
      {acoes}
    </div>
  );
}

export function Pagina({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("mx-auto w-full max-w-[1680px] px-4 py-5 sm:px-6", className)}>{children}</div>;
}

export function Carregando() {
  return (
    <div className="grid gap-3 md:grid-cols-3" aria-busy="true" aria-label="Carregando">
      {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded bg-borda/60" />)}
    </div>
  );
}

const BOTAO = {
  primario: "border-azul bg-azul text-white hover:bg-azul-escuro hover:border-azul-escuro",
  secundario: "border-borda-forte bg-superficie text-texto hover:bg-realce",
  discreto: "border-transparent text-azul hover:bg-azul-claro",
};
export const classeBotao = (variante: keyof typeof BOTAO = "secundario", extra?: string) =>
  clsx("inline-flex h-8 items-center gap-1.5 rounded border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50", BOTAO[variante], extra);

/** Tabela de dados: cabeçalho fixo em cinza, números tabulares, linhas com fio. */
export function Tabela({ cabecalho, children, className }: { cabecalho: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("overflow-x-auto", className)}>
      <table className="num w-full text-[13.5px] whitespace-nowrap">
        <thead>
          <tr className="border-b border-borda bg-realce text-left">
            {cabecalho.map((c, i) => <th key={i} scope="col" className="px-3 py-2 text-[12.5px] font-semibold text-texto-2">{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">{children}</tbody>
      </table>
    </div>
  );
}

/** Barra de proporções: partes com 2 px de respiro entre si; cada parte tem nome para leitor de tela. */
export function Segmentos({ partes, altura = "h-2.5" }: { partes: { valor: number; cor: string; rotulo?: string }[]; altura?: string }) {
  const total = partes.reduce((s, p) => s + p.valor, 0) || 1;
  return (
    <div className={clsx("flex w-full gap-[2px] overflow-hidden rounded-[2px]", altura)} role="img" aria-label={partes.filter((p) => p.valor).map((p) => `${p.rotulo}: ${p.valor}`).join("; ")}>
      {partes.filter((p) => p.valor > 0).map((p, i) => <span key={i} title={`${p.rotulo}: ${p.valor}`} style={{ width: `${(p.valor / total) * 100}%`, background: p.cor }} />)}
    </div>
  );
}

/** Aviso em linha: fundo tingido e ícone, sem faixa lateral. */
export function Aviso({ children, tom = "ambar", className }: { children: ReactNode; tom?: Tom; className?: string }) {
  return <div className={clsx("rounded border px-3.5 py-2.5 text-[13.5px] leading-relaxed", FUNDO_TOM[tom], tom === "ambar" && "border-ambar/30", tom === "azul" && "border-azul/25", tom === "vermelho" && "border-vermelho/30", tom === "verde" && "border-verde/30", tom === "neutro" && "border-borda", className)}>{children}</div>;
}
