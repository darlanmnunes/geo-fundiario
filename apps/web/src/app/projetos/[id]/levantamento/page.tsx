import { Suspense } from "react";
import Link from "next/link";
import { Carregando, Dado, Numero, Painel, Tabela } from "@/components/ui";
import { lotesDe, obterProjeto } from "@/lib/dados";
import { erroEsferico, fmt, LIMITE_ERRO_ESFERICO_M } from "@/lib/dominio";

export const metadata = { title: "Levantamento de campo" };

async function Conteudo({ params }: Pick<PageProps<"/projetos/[id]/levantamento">, "params">) {
  const p = obterProjeto((await params).id)!;
  const vertices = new Map<string, { codigo: string; tipo: string; metodo: string; erro: number; lotes: string[] }>();
  for (const l of lotesDe(p)) {
    for (const v of l.vertices) {
      const atual = vertices.get(v.codigo) ?? { codigo: v.codigo, tipo: v.tipo, metodo: v.metodo, erro: erroEsferico(v.sigma), lotes: [] };
      atual.lotes.push(l.codigo);
      vertices.set(v.codigo, atual);
    }
  }
  const lista = [...vertices.values()].sort((a, b) => b.erro - a.erro);
  const fora = lista.filter((v) => v.erro > LIMITE_ERRO_ESFERICO_M);
  const marcos = lista.filter((v) => v.tipo === "M").length;
  const faixas = Array.from({ length: 13 }, (_, i) => ({ de: i, n: lista.filter((v) => Math.floor(v.erro * 100) === i).length }));
  const max = Math.max(...faixas.map((f) => f.n));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y fio py-4 md:grid-cols-4">
        <Numero rotulo="Vértices de limite" valor={lista.length} detalhe={`${marcos} marcos implantados`} />
        <Numero rotulo="Dentro do limite" valor={lista.length - fora.length} tom="ok" detalhe="≤ 8 cm (Dec. 9.310, art. 29)" />
        <Numero rotulo="Fora do limite" valor={fora.length} tom={fora.length ? "alerta" : "ok"} detalhe="exigem nova medição" />
        <Numero rotulo="Referencial" valor={<span className="text-[22px]">SIRGAS 2000</span>} detalhe={`UTM 23S · EPSG:${p.srid_utm}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Painel titulo="Distribuição do erro posicional esférico" aside="faixas de 1 cm">
          <div className="flex h-44 items-end gap-1">
            {faixas.map((f) => (
              <div key={f.de} className="flex flex-1 flex-col items-center gap-1">
                <span className="tab text-[10px] text-tinta-500">{f.n || ""}</span>
                <div className={f.de >= 8 ? "w-full rounded-t-[2px] bg-ocre-600" : "w-full rounded-t-[2px] bg-tinta-700"} style={{ height: `${max ? (f.n / max) * 130 : 0}px` }} />
                <span className="tab text-[10px] text-tinta-500">{f.de}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[12px] text-tinta-500">centímetros — em ocre, acima do limite legal</p>
        </Painel>

        <Painel titulo="Especificação do levantamento">
          <div className="grid gap-3 sm:grid-cols-2">
            <Dado rotulo="Normas" className="sm:col-span-2">ABNT NBR 13133:2021 (topografia) · NBR 17047:2022 (levantamento cadastral para registro público) · NBR 14166 (rede de referência cadastral municipal)</Dado>
            <Dado rotulo="Métodos">Marcos de quadra por GNSS RTK; divisas internas por irradiação com estação total</Dado>
            <Dado rotulo="Coordenadas">Tridimensionais por vértice, ligadas ao SGB</Dado>
            <Dado rotulo="Responsável técnico" className="sm:col-span-2">{p.responsavel_tecnico} · ART {p.art_rrt}</Dado>
          </div>
        </Painel>
      </div>

      <Painel titulo="Vértices fora da especificação" aside={`${fora.length} de ${lista.length}`}>
        {fora.length ? (
          <Tabela cabecalho={["Vértice", "Método", "Erro esférico", "Lotes afetados"]}>
            {fora.map((v) => (
              <tr key={v.codigo}>
                <td className="mono py-2 pr-4 font-medium">{v.codigo}</td>
                <td className="py-2 pr-4 text-tinta-700">{v.metodo === "gnss_rtk" ? "GNSS RTK" : "Estação total"}</td>
                <td className="mono py-2 pr-4 text-right font-medium text-carimbo-600">{fmt.num(v.erro * 100, 1)} cm</td>
                <td className="py-2">
                  <span className="flex flex-wrap gap-1.5">
                    {v.lotes.map((c) => <Link key={c} href={`/projetos/${p.id}/lotes/${c}`} className="mono rounded border fio px-1.5 py-0.5 text-[11.5px] text-terra-700 hover:bg-terra-100/50">{c}</Link>)}
                  </span>
                </td>
              </tr>
            ))}
          </Tabela>
        ) : (
          <p className="text-[13px] text-oliva-700">Todos os vértices atendem ao limite.</p>
        )}
      </Painel>
    </div>
  );
}

export default function Levantamento({ params }: PageProps<"/projetos/[id]/levantamento">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}
