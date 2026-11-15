"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowRight, FilterX } from "lucide-react";
import { BarraLimite, BarrasH, Colunas, Rosca } from "./graficos";
import { Mapa } from "./mapa";
import { Prazo } from "./prazo";
import { TrilhaFases } from "./trilha-fases";
import { Etiqueta, FaixaIndicadores, Indicador, Painel, Ponto, Tabela, classeBotao } from "./ui";
import type { CamadasMapa } from "@/lib/dados";
import { ESCOLARIDADE, FAIXA_IDADE, FAIXA_RENDA, fasePorCodigo, fmt, MODALIDADE, SITUACAO_LOTE, SITUACAO_PROFISSIONAL, SITUACOES, type CodigoFase, type SituacaoLote, type Tom } from "@/lib/dominio";

export interface NucleoResumo {
  id: number;
  nome: string;
  modalidade: string;
  processo: string;
  faseAtual: CodigoFase;
  fases: { codigo: string; situacao: string }[];
  prazo: string | null;
  vertices: number;
  verticesFora: number;
  aptidao: number | null;
  tolerancia: string;
}
export interface UnidadeResumo {
  projeto: number;
  situacao: SituacaoLote;
  pendencias: number;
  pessoas: number;
  renda: string | null;
  idade: string | null;
  escolaridade: string | null;
  profissao: string | null;
  docsFaltando: number;
}
export interface ItemAgenda {
  projeto: number;
  nucleo: string;
  tipo: "prazo" | "impugnacao" | "assinatura" | "vertices";
  texto: string;
  detalhe?: string;
  data?: string;
  href: string;
}

const TIPO_AGENDA: Record<ItemAgenda["tipo"], { rotulo: string; tom: Tom }> = {
  prazo: { rotulo: "Prazo legal", tom: "ambar" },
  impugnacao: { rotulo: "Impugnação", tom: "vermelho" },
  assinatura: { rotulo: "Assinatura", tom: "azul" },
  vertices: { rotulo: "Remedição", tom: "roxo" },
};

const contar = (chaves: Record<string, string>, valores: (string | null)[]) =>
  Object.entries(chaves).map(([chave, rotulo]) => ({ chave, rotulo, valor: valores.filter((v) => v === chave).length }));

export function PainelGeral({ nucleos, unidades, agenda, camadas }: { nucleos: NucleoResumo[]; unidades: UnidadeResumo[]; agenda: ItemAgenda[]; camadas: CamadasMapa }) {
  const router = useRouter();
  const [nucleo, setNucleo] = useState<number | null>(null);
  const [situacoes, setSituacoes] = useState<Set<SituacaoLote>>(new Set(SITUACOES));
  const filtrado = nucleo !== null || situacoes.size !== SITUACOES.length;

  const doNucleo = useMemo(() => unidades.filter((u) => nucleo === null || u.projeto === nucleo), [unidades, nucleo]);
  const visiveis = useMemo(() => doNucleo.filter((u) => situacoes.has(u.situacao)), [doNucleo, situacoes]);
  const nucleosVisiveis = nucleos.filter((n) => nucleo === null || n.id === nucleo);
  const ocupadas = visiveis.filter((u) => u.renda !== null);
  const aptas = visiveis.filter((u) => u.situacao === "apto_crf").length;
  const pendencias = visiveis.reduce((s, u) => s + u.pendencias, 0);
  const vertices = nucleosVisiveis.reduce((s, n) => s + n.vertices, 0);
  const verticesFora = nucleosVisiveis.reduce((s, n) => s + n.verticesFora, 0);
  const porSituacao = SITUACOES.map((x) => ({ chave: x, rotulo: SITUACAO_LOTE[x].rotulo, valor: doNucleo.filter((u) => u.situacao === x).length, cor: SITUACAO_LOTE[x].cor }));
  const agendaVisivel = agenda.filter((a) => nucleo === null || a.projeto === nucleo);

  const alternarSituacao = (s: string) =>
    setSituacoes((atual) => {
      const chave = s as SituacaoLote;
      // Primeiro clique isola a situação; cliques seguintes somam ou retiram.
      if (atual.size === SITUACOES.length) return new Set([chave]);
      const n = new Set(atual);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n.size ? n : new Set(SITUACOES);
    });
  const limpar = () => {
    setNucleo(null);
    setSituacoes(new Set(SITUACOES));
  };

  return (
    <div className="space-y-4">
      {/* Filtros: valem para tudo o que está abaixo */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[13px] text-texto-2" id="rotulo-filtro-nucleo">Núcleo</span>
        <div role="group" aria-labelledby="rotulo-filtro-nucleo" className="flex flex-wrap overflow-hidden rounded border border-borda-forte bg-superficie">
          {[{ id: null as number | null, nome: "Todos" }, ...nucleos.map((n) => ({ id: n.id as number | null, nome: n.nome.replace("Núcleo ", "") }))].map((n) => (
            <button key={String(n.id)} type="button" onClick={() => setNucleo(n.id)} aria-pressed={nucleo === n.id}
              className={clsx("h-8 border-r border-borda px-3 text-[13px] last:border-r-0", nucleo === n.id ? "bg-azul font-semibold text-white" : "text-texto hover:bg-realce")}>
              {n.nome}
            </button>
          ))}
        </div>
        {filtrado && (
          <button type="button" onClick={limpar} className={classeBotao("discreto")}>
            <FilterX className="size-4" aria-hidden /> Limpar filtros
          </button>
        )}
        <p className="ml-auto text-[13px] text-texto-3" aria-live="polite">
          {filtrado ? `Mostrando ${visiveis.length} de ${unidades.length} unidades` : "Clique num núcleo, numa barra ou numa unidade do mapa para filtrar"}
        </p>
      </div>

      <FaixaIndicadores className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <Indicador rotulo="Núcleos em regularização" valor={nucleosVisiveis.length} nota={nucleosVisiveis.map((n) => MODALIDADE[n.modalidade]).join(", ")} />
        <Indicador rotulo="Unidades" valor={fmt.int(visiveis.length)} nota={`${ocupadas.length} com ocupante identificado`} />
        <Indicador rotulo="Pessoas beneficiadas" valor={fmt.int(visiveis.reduce((s, u) => s + u.pessoas, 0))} nota={`${ocupadas.length} famílias`} />
        <Indicador rotulo="Aptas à CRF" valor={fmt.int(aptas)} tom="verde" nota={`${fmt.pct(aptas, visiveis.length)} das unidades`} />
        <Indicador rotulo="Pendências em aberto" valor={fmt.int(pendencias)} tom={pendencias ? "ambar" : "neutro"} nota={`${visiveis.filter((u) => u.pendencias).length} unidades afetadas`} />
        <Indicador rotulo="Vértices dentro da tolerância" valor={fmt.pct(vertices - verticesFora, vertices)} tom={verticesFora ? "neutro" : "verde"} nota={`${verticesFora} de ${vertices} a remedir`} />
      </FaixaIndicadores>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Painel titulo="Mapa dos núcleos" aside="Clique numa unidade para abrir a ficha" className="flex flex-col" corpo="relative min-h-[460px] flex-1">
          <Mapa
            camadas={camadas}
            foco={nucleo}
            situacoes={situacoes.size === SITUACOES.length ? undefined : [...situacoes]}
            aoSelecionar={(uid) => uid && router.push(`/projetos/${uid.split(":")[0]}/lotes/${uid.split(":")[1]}`)}
            rotuloNucleo
            className="!absolute inset-0 rounded-none border-0"
          />
        </Painel>

        <div className="grid content-start gap-4">
          <Painel titulo="Unidades por situação" aside={`${doNucleo.length} unidades`}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Rosca itens={porSituacao} aoClicar={alternarSituacao} ativos={situacoes as Set<string>} rotuloCentro="unidades" />
              <div className="min-w-[230px] flex-1">
                <BarrasH itens={porSituacao} aoClicar={alternarSituacao} ativos={situacoes as Set<string>} unidade="unidades" larguraRotulo="7rem" />
              </div>
            </div>
            <p className="mt-2 border-t border-borda pt-2 text-[12.5px] text-texto-3">As mesmas cores valem no mapa. Clicar numa barra filtra o painel inteiro.</p>
          </Painel>

          <Painel titulo="Exige decisão" aside={`${agendaVisivel.length} ${agendaVisivel.length === 1 ? "item" : "itens"}`} corpo="p-0">
            <ul className="max-h-[330px] divide-y divide-borda overflow-y-auto">
              {agendaVisivel.map((a, i) => (
                <li key={i}>
                  <Link href={a.href} className="block px-3.5 py-2 hover:bg-realce">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[13.5px] leading-snug text-texto">{a.texto}</span>
                      <Etiqueta tom={TIPO_AGENDA[a.tipo].tom}>{TIPO_AGENDA[a.tipo].rotulo}</Etiqueta>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-texto-3">
                      {a.nucleo.replace("Núcleo ", "")}{a.detalhe ? ` - ${a.detalhe}` : ""}
                      {a.data && <Prazo data={a.data} compacto />}
                    </span>
                  </Link>
                </li>
              ))}
              {!agendaVisivel.length && <li className="px-3.5 py-6 text-center text-[13.5px] text-texto-3">Nada aguardando decisão neste recorte.</li>}
            </ul>
          </Painel>
        </div>
      </div>

      <Painel titulo="Andamento dos núcleos" aside="As dez fases do art. 28 da Lei 13.465/2017 e etapas técnicas" corpo="p-0">
        <Tabela cabecalho={["Núcleo", "Modalidade", "Fase atual", "Andamento", "Unidades", "Aptas à CRF", "Pendências", "Aptidão territorial", "Prazo em curso", ""]}>
          {nucleos.map((n) => {
            const us = unidades.filter((u) => u.projeto === n.id);
            const ap = us.filter((u) => u.situacao === "apto_crf").length;
            return (
              <tr key={n.id} className={clsx("hover:bg-realce", nucleo !== null && nucleo !== n.id && "opacity-45")}>
                <td className="px-3 py-2">
                  <Link href={`/projetos/${n.id}`} className="font-semibold text-azul hover:underline">{n.nome}</Link>
                  <span className="cod block text-[12px] text-texto-3">{n.processo}</span>
                </td>
                <td className="px-3 py-2"><Etiqueta tom={n.modalidade === "reurb_s" ? "azul" : "roxo"}>{MODALIDADE[n.modalidade]}</Etiqueta></td>
                <td className="px-3 py-2 text-texto">{fasePorCodigo[n.faseAtual].nome}</td>
                <td className="px-3 py-2"><TrilhaFases fases={n.fases} legenda={false} percentual className="w-48" /></td>
                <td className="px-3 py-2 text-right">{us.length}</td>
                <td className="px-3 py-2 text-right">{ap} <span className="text-texto-3">({fmt.pct(ap, us.length)})</span></td>
                <td className="px-3 py-2 text-right">{us.reduce((s, u) => s + u.pendencias, 0)}</td>
                <td className="px-3 py-2 text-right">{n.aptidao ?? "sem dossiê"}{n.aptidao !== null && <span className="text-texto-3"> / 100</span>}</td>
                <td className="px-3 py-2">{n.prazo ? <Prazo data={n.prazo} /> : <span className="text-texto-3">sem prazo legal correndo</span>}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/projetos/${n.id}`} className={classeBotao("secundario", "h-7")}>Abrir <ArrowRight className="size-3.5" aria-hidden /></Link>
                </td>
              </tr>
            );
          })}
        </Tabela>
      </Painel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Painel titulo="Renda familiar" aside={`${ocupadas.length} famílias`}>
          <Colunas itens={contar(FAIXA_RENDA, ocupadas.map((u) => u.renda)).map((i) => ({ ...i, rotulo: i.rotulo.replace(" SM", "") }))} destaque={{ chave: "acima_5", cor: "#e2780c" }} />
          <p className="mt-2 text-[12.5px] text-texto-3">Em salários mínimos. Acima de 5 SM (em laranja) não se enquadra na REURB-S (Dec. 9.310/2018, art. 6º).</p>
        </Painel>
        <Painel titulo="Idade do responsável familiar">
          <Colunas itens={contar(FAIXA_IDADE, ocupadas.map((u) => u.idade)).map((i) => ({ ...i, rotulo: i.rotulo.replace(" anos", "") }))} />
          <p className="mt-2 text-[12.5px] text-texto-3">Em anos, na data do cadastro social.</p>
        </Painel>
        <Painel titulo="Escolaridade">
          <BarrasH itens={contar(ESCOLARIDADE, ocupadas.map((u) => u.escolaridade))} larguraRotulo="6.5rem" />
        </Painel>
        <Painel titulo="Situação profissional">
          <BarrasH itens={contar(SITUACAO_PROFISSIONAL, ocupadas.map((u) => u.profissao))} larguraRotulo="9.5rem" />
        </Painel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo="Qualidade posicional do levantamento" aside="Tolerância da norma aplicada a cada núcleo">
          <ul className="space-y-3">
            {nucleosVisiveis.map((n) => (
              <li key={n.id} className="grid grid-cols-[9.5rem_1fr] items-start gap-3">
                <Link href={`/projetos/${n.id}/levantamento`} className="truncate pt-px text-[13px] text-azul hover:underline">{n.nome.replace("Núcleo ", "")}</Link>
                <BarraLimite dentro={n.vertices - n.verticesFora} fora={n.verticesFora} rotuloDentro={`dentro de ${n.tolerancia}`} rotuloFora="a remedir" />
              </li>
            ))}
          </ul>
        </Painel>
        <Painel titulo="Documentação dos ocupantes" aside="Documentos obrigatórios por família">
          <ul className="space-y-3">
            {nucleosVisiveis.map((n) => {
              const fam = unidades.filter((u) => u.projeto === n.id && u.renda !== null);
              const falta = fam.filter((u) => u.docsFaltando > 0).length;
              return (
                <li key={n.id} className="grid grid-cols-[9.5rem_1fr] items-start gap-3">
                  <Link href={`/projetos/${n.id}/lotes`} className="truncate pt-px text-[13px] text-azul hover:underline">{n.nome.replace("Núcleo ", "")}</Link>
                  <BarraLimite dentro={fam.length - falta} fora={falta} rotuloDentro="famílias com tudo entregue" rotuloFora="com documento faltando" />
                </li>
              );
            })}
          </ul>
        </Painel>
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-texto-3">
        Legenda das situações:
        {SITUACOES.map((s) => <span key={s} className="flex items-center gap-1.5"><Ponto cor={SITUACAO_LOTE[s].cor} /> {SITUACAO_LOTE[s].rotulo}: {SITUACAO_LOTE[s].descricao}</span>)}
      </p>
    </div>
  );
}
