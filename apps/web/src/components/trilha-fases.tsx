import clsx from "clsx";
import { FASES } from "@/lib/dominio";
import type { FaseProjeto } from "@/lib/dados";

/** Dez células, uma por fase: cheia = concluída, contornada = em andamento, vazia = pendente. */
export function TrilhaFases({ fases, className }: { fases: FaseProjeto[]; className?: string }) {
  const porCodigo = Object.fromEntries(fases.map((f) => [f.codigo, f]));
  const atual = FASES.find((f) => porCodigo[f.codigo]?.situacao === "em_andamento");
  return (
    <div className={className}>
      <ol className="flex gap-[3px]" aria-label="Fases do processo">
        {FASES.map((f, i) => {
          const s = porCodigo[f.codigo]?.situacao ?? "pendente";
          return (
            <li
              key={f.codigo}
              title={`${i + 1}. ${f.nome}`}
              className={clsx(
                "h-2 flex-1 rounded-[1px]",
                s === "concluida" && "bg-tinta-900",
                s === "em_andamento" && "bg-terra-500",
                s === "pendente" && "bg-papel-300",
              )}
            />
          );
        })}
      </ol>
      {atual && (
        <p className="mt-1.5 text-[12px] text-tinta-500">
          <span className="tab">{FASES.indexOf(atual) + 1}/10</span> · <span className="text-tinta-900">{atual.nome}</span>
        </p>
      )}
    </div>
  );
}
