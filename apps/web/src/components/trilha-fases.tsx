import clsx from "clsx";
import { FASES } from "@/lib/dominio";

/** Dez células, uma por fase: cheia = concluída, azul = em andamento, vazia = não iniciada. */
export function TrilhaFases({ fases, className, legenda = true, percentual = false }: { fases: { codigo: string; situacao: string }[]; className?: string; legenda?: boolean; percentual?: boolean }) {
  const porCodigo = Object.fromEntries(fases.map((f) => [f.codigo, f]));
  const atual = FASES.find((f) => porCodigo[f.codigo]?.situacao === "em_andamento");
  const feitas = FASES.filter((f) => porCodigo[f.codigo]?.situacao === "concluida").length;
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
      <ol className="flex flex-1 gap-[3px]" aria-label={`Fases do processo: ${feitas} de 10 concluídas${atual ? `; em andamento: ${atual.nome}` : ""}`}>
        {FASES.map((f, i) => {
          const s = porCodigo[f.codigo]?.situacao ?? "pendente";
          return (
            <li
              key={f.codigo}
              title={`${i + 1}. ${f.nome}${s === "concluida" ? " (concluída)" : s === "em_andamento" ? " (em andamento)" : ""}`}
              className={clsx("h-2.5 flex-1 rounded-[1px]", s === "concluida" && "bg-marinho", s === "em_andamento" && "bg-[#ffb000] ring-1 ring-ambar/50", s !== "concluida" && s !== "em_andamento" && "bg-borda")}
            />
          );
        })}
      </ol>
      {percentual && <span className="num w-9 text-right text-[13px] font-semibold text-texto" title={`${feitas} de 10 fases concluídas`}>{feitas * 10}%</span>}
      </div>
      {legenda && atual && (
        <p className="mt-1 text-[12.5px] text-texto-2">
          Fase <span className="num">{FASES.indexOf(atual) + 1}</span> de 10: <span className="font-semibold text-texto">{atual.nome}</span>
        </p>
      )}
    </div>
  );
}
