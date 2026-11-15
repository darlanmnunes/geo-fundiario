import { Suspense } from "react";
import Link from "next/link";
import { Colunas } from "@/components/graficos";
import { Aviso, Carregando, Dado, Etiqueta, FaixaIndicadores, Indicador, Painel, Tabela } from "@/components/ui";
import { obterProjeto, verticesDe } from "@/lib/dados";
import { fmt, fmtTolerancia, METODO_MEDICAO, NORMAS, rotuloComponente } from "@/lib/dominio";

export const metadata = { title: "Levantamento de campo" };

async function Conteudo({ params }: Pick<PageProps<"/projetos/[id]/levantamento">, "params">) {
  const p = obterProjeto((await params).id)!;
  const tol = p.precisao.tolerancia_m;
  const tolTexto = fmtTolerancia(tol);
  const lista = verticesDe(p).sort((a, b) => b.erro - a.erro);
  const fora = lista.filter((v) => v.erro > tol);
  const marcos = lista.filter((v) => v.tipo === "M").length;
  const faixas = Array.from({ length: 11 }, (_, i) => ({
    chave: String(i),
    rotulo: i === 10 ? "10+" : `${i}-${i + 1}`,
    valor: lista.filter((v) => (i === 10 ? v.erro * 100 >= 10 : Math.floor(v.erro * 100) === i)).length,
    cor: i >= Math.round(tol * 100) ? "#c4281c" : "#1351b4",
  }));
  const c = p.cartografia;

  return (
    <div className="space-y-4">
      <FaixaIndicadores className="grid-cols-2 md:grid-cols-4">
        <Indicador rotulo="Vértices de limite" valor={lista.length} nota={`${marcos} marcos implantados (GNSS)`} />
        <Indicador rotulo={`Dentro da tolerância de ${tolTexto}`} valor={lista.length - fora.length} tom="verde" nota={fmt.pct(lista.length - fora.length, lista.length)} />
        <Indicador rotulo="Acima da tolerância" valor={fora.length} tom={fora.length ? "vermelho" : "verde"} nota={fora.length ? "exigem nova medição" : "nenhum a remedir"} />
        <Indicador rotulo="Sistema de referência" valor={<span className="text-[18px]">SIRGAS 2000</span>} nota={`UTM fuso ${c.fuso} S (EPSG:${p.srid_utm})`} />
      </FaixaIndicadores>

      <Aviso tom="azul">
        <b>Norma aplicada a este núcleo: {p.precisao.descricao}.</b> Tolerância de {tolTexto} no erro posicional {rotuloComponente(p.precisao)} ({p.precisao.base_legal}). {p.precisao.aplicacao}{" "}
        A tolerância não é a mesma para todo imóvel: em georreferenciamento rural, por exemplo, vale 0,50 m para limites artificiais, 3,00 m para naturais e 7,50 m para inacessíveis, na componente planimétrica. O sistema aplica a norma cadastrada no projeto.
        {p.precisao.componente === "tridimensional" && <> Erro tridimensional é a resultante √(σ<sub>E</sub>² + σ<sub>N</sub>² + σ<sub>h</sub>²), que o decreto chama de “erro posicional esférico”.</>}
      </Aviso>

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo={`Distribuição do erro posicional ${rotuloComponente(p.precisao)}`} aside="Vértices por faixa de 1 cm">
          <Colunas itens={faixas} altura={150} />
          <p className="mt-2 text-[12.5px] text-texto-3">Em centímetros. Em vermelho, as faixas acima da tolerância de {tolTexto}.</p>
        </Painel>

        <Painel titulo="Especificação do levantamento">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Dado rotulo="Normas" className="sm:col-span-2">
              <a className="text-azul hover:underline" href={NORMAS.nbr13133.url} target="_blank" rel="noreferrer">ABNT NBR 13133:2021</a> (levantamento topográfico), <a className="text-azul hover:underline" href={NORMAS.nbr17047.url} target="_blank" rel="noreferrer">NBR 17047:2022</a> (levantamento cadastral para registro público) e <a className="text-azul hover:underline" href={NORMAS.nbr14166.url} target="_blank" rel="noreferrer">NBR 14166</a> (rede de referência cadastral municipal)
            </Dado>
            <Dado rotulo="Equipamento">{p.levantamento.equipamento ?? "não informado"}</Dado>
            <Dado rotulo="Período de campo">{fmt.data(p.levantamento.data_inicio)} a {fmt.data(p.levantamento.data_fim)}</Dado>
            <Dado rotulo="Projeção">UTM, fuso {c.fuso} S, meridiano central {Math.abs(c.meridiano_central)}° W</Dado>
            <Dado rotulo="Plano de cálculo das peças">{p.plano_calculo === "sgl" ? "Sistema Geodésico Local (plano topográfico, NBR 14166)" : "Plano de projeção UTM"}; a ficha de cada unidade mostra a área nos dois</Dado>
            <Dado rotulo="Fator de escala (k) no centro do núcleo" cod>{fmt.num(c.fator_escala, 6)}</Dado>
            <Dado rotulo="Convergência meridiana no centro do núcleo"><span className="cod">{fmt.gms(c.convergencia_graus)}</span> <span className="text-[12.5px] text-texto-3">(norte da quadrícula a {c.convergencia_graus < 0 ? "oeste" : "leste"} do norte verdadeiro)</span></Dado>
            <Dado rotulo="Responsável técnico" className="sm:col-span-2">{p.responsavel_tecnico}, ART {p.art_rrt}</Dado>
          </dl>
        </Painel>
      </div>

      <Painel titulo="Vértices acima da tolerância" aside={`${fora.length} de ${lista.length}`} corpo="p-0">
        {fora.length ? (
          <Tabela cabecalho={["Vértice", "Tipo", "Método", `Erro ${rotuloComponente(p.precisao)}`, "Excesso", "Unidades afetadas"]}>
            {fora.map((v) => (
              <tr key={v.codigo} className="hover:bg-realce">
                <td className="cod px-3 py-2 font-medium">{v.codigo}</td>
                <td className="px-3 py-2"><Etiqueta>{v.tipo === "M" ? "Marco" : "Ponto"}</Etiqueta></td>
                <td className="px-3 py-2 text-texto-2">{METODO_MEDICAO[v.metodo] ?? v.metodo}</td>
                <td className="cod px-3 py-2 text-right font-medium text-vermelho">{fmt.num(v.erro * 100, 1)} cm</td>
                <td className="cod px-3 py-2 text-right text-texto-2">+{fmt.num((v.erro - tol) * 100, 1)} cm</td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1.5">
                    {v.lotes.map((cod) => <Link key={cod} href={`/projetos/${p.id}/lotes/${cod}`} className="cod rounded border border-borda px-1.5 py-px text-[12.5px] text-azul hover:bg-azul-claro">{cod}</Link>)}
                  </span>
                </td>
              </tr>
            ))}
          </Tabela>
        ) : (
          <p className="p-4 text-[13.5px] text-verde">Todos os vértices atendem à tolerância de {tolTexto}.</p>
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
