import { ExternalLink } from "lucide-react";
import { FluxoFases } from "@/components/fluxo-fases";
import { Cabecalho, Pagina, Painel } from "@/components/ui";
import { NORMAS, REPOSITORIO } from "@/lib/dominio";

export const metadata = { title: "Base legal" };

export default function Legislacao() {
  const grupos = [...new Set(Object.values(NORMAS).map((n) => n.grupo))];
  return (
    <Pagina>
      <Cabecalho
        titulo="Base legal"
        descricao="As fases do processo de REURB, com o que cada uma exige, e as leis e normas que sustentam o sistema. Cada item leva ao texto oficial."
      />

      <Painel className="mt-4" titulo="Fases do processo" aside="Clique numa fase ou use as setas do teclado" corpo="p-0">
        <FluxoFases />
      </Painel>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {grupos.map((g) => (
          <Painel key={g} titulo={g} corpo="p-0">
            <ul className="divide-y divide-borda">
              {Object.values(NORMAS).filter((n) => n.grupo === g).map((n) => (
                <li key={n.rotulo} className="px-3.5 py-2.5">
                  <a href={n.url} target="_blank" rel="noreferrer" className="inline-flex items-baseline gap-1 text-[14px] font-semibold text-azul hover:underline">
                    {n.rotulo}<ExternalLink className="size-3 translate-y-px" aria-label="(abre em nova aba)" />
                  </a>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-texto-2">{n.resumo}</p>
                </li>
              ))}
            </ul>
          </Painel>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-texto-3">
        Normas da ABNT e da ISO são pagas: o link leva à ficha da norma. O detalhamento do marco legal, com todas as fontes, está em{" "}
        <a className="text-azul hover:underline" href={`${REPOSITORIO}/blob/main/docs/marco-legal-e-fluxo-reurb.md`} target="_blank" rel="noreferrer">docs/marco-legal-e-fluxo-reurb.md</a>.
      </p>
    </Pagina>
  );
}
