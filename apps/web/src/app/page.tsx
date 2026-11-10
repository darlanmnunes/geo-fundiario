import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Prazo } from "@/components/prazo";
import { TrilhaFases } from "@/components/trilha-fases";
import { Cabecalho, Carimbo, Numero, Painel, Ponto, Rotulo, Segmentos } from "@/components/ui";
import { indicadores, listarProjetos } from "@/lib/dados";
import { fasePorCodigo, fmt, MODALIDADE, SITUACAO_LOTE, type SituacaoLote } from "@/lib/dominio";

export default function Mesa() {
  const projetos = listarProjetos().map((p) => ({ p, k: indicadores(p) }));
  const total = projetos.reduce(
    (a, { k }) => ({ lotes: a.lotes + k.lotes, familias: a.familias + k.familias, aptos: a.aptos + k.porSituacao.apto_crf, pend: a.pend + k.pendencias, docs: a.docs + k.docsPendentes, ass: a.ass + k.assinaturasPendentes }),
    { lotes: 0, familias: 0, aptos: 0, pend: 0, docs: 0, ass: 0 },
  );
  const agenda = projetos.flatMap(({ p }) => [
    ...p.fases.filter((f) => f.prazo_em && f.situacao === "em_andamento").map((f) => ({ projeto: p, tipo: "prazo" as const, rotulo: `${fasePorCodigo[f.codigo].nome} — prazo legal de ${fasePorCodigo[f.codigo].prazoDias} dias`, data: f.prazo_em! })),
    ...p.notificacoes.filter((n) => n.resposta === "impugnacao").map((n) => ({ projeto: p, tipo: "impugnacao" as const, rotulo: `Impugnação de ${n.destinatario}`, data: n.prazo_fim, detalhe: n.impugnacao })),
    ...p.documentos.flatMap((d) => d.assinaturas.filter((a) => a.situacao === "pendente").map((a) => ({ projeto: p, tipo: "assinatura" as const, rotulo: `Assinatura pendente — ${d.titulo}`, data: d.data, detalhe: a.nome }))),
  ]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6">
      <Cabecalho
        sobretitulo="Mesa de trabalho"
        titulo="Núcleos em regularização"
        descricao="Cada linha é um núcleo urbano informal em processo de REURB. A trilha mostra as dez fases, do diagnóstico ao registro; a coluna da direita reúne o que exige decisão hoje."
      />

      <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-y fio py-4 md:grid-cols-6">
        <Numero rotulo="Núcleos" valor={projetos.length} />
        <Numero rotulo="Lotes" valor={fmt.int(total.lotes)} />
        <Numero rotulo="Famílias" valor={fmt.int(total.familias)} />
        <Numero rotulo="Aptos à CRF" valor={fmt.int(total.aptos)} tom="ok" detalhe={`${Math.round((total.aptos / total.lotes) * 100)}% dos lotes`} />
        <Numero rotulo="Pendências" valor={fmt.int(total.pend)} tom="alerta" detalhe={`${total.docs} documentos faltando`} />
        <Numero rotulo="Assinaturas" valor={fmt.int(total.ass)} tom="info" detalhe="aguardando" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {projetos.map(({ p, k }) => {
            const prazo = p.fases.find((f) => f.situacao === "em_andamento" && f.prazo_em);
            return (
              <Link key={p.id} href={`/projetos/${p.id}`} className="painel group block transition-colors hover:border-tinta-900/30">
                <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[20px] leading-tight">{p.nome}</h2>
                      <Carimbo tom={p.modalidade === "reurb_s" ? "terra" : "registro"}>{MODALIDADE[p.modalidade]}</Carimbo>
                    </div>
                    <p className="mt-1 text-[12.5px] text-tinta-500">
                      {p.processo_adm} · {p.municipio}/{p.uf} · {p.legitimado}
                    </p>
                    <TrilhaFases fases={p.fases} className="mt-4 max-w-md" />
                  </div>
                  <div className="min-w-0">
                    <Rotulo className="mb-1.5">{k.lotes} lotes · {k.familias} famílias</Rotulo>
                    <Segmentos partes={(Object.keys(SITUACAO_LOTE) as SituacaoLote[]).map((s) => ({ valor: k.porSituacao[s], cor: SITUACAO_LOTE[s].cor, rotulo: SITUACAO_LOTE[s].rotulo }))} altura="h-2" />
                    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px] text-tinta-700">
                      {(Object.keys(SITUACAO_LOTE) as SituacaoLote[]).map((s) => (
                        <li key={s} className="flex items-center gap-1.5"><Ponto cor={SITUACAO_LOTE[s].cor} /> {SITUACAO_LOTE[s].rotulo} <span className="tab ml-auto text-tinta-900">{k.porSituacao[s]}</span></li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col items-end justify-between gap-2 text-right">
                    <ArrowUpRight className="size-4 text-tinta-300 transition-colors group-hover:text-terra-600" />
                    {prazo ? (
                      <div>
                        <Rotulo>Prazo em curso</Rotulo>
                        <Prazo data={prazo.prazo_em!} />
                      </div>
                    ) : (
                      <div>
                        <Rotulo>Renda média</Rotulo>
                        <span className="tab text-[13px]">{fmt.num(k.rendaMediaSm, 1)} SM</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="space-y-4">
          <Painel titulo="Exige decisão" aside={`${agenda.length} itens`} corpo="p-0">
            <ul className="divide-y divide-[color:var(--linha)]">
              {agenda.map((x, i) => (
                <li key={i} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] leading-snug text-tinta-900">{x.rotulo}</p>
                    <Carimbo tom={x.tipo === "impugnacao" ? "carimbo" : x.tipo === "assinatura" ? "registro" : "ocre"}>{x.tipo}</Carimbo>
                  </div>
                  <p className="mt-0.5 text-[12px] text-tinta-500">{x.projeto.nome.replace("Núcleo ", "")}{"detalhe" in x && x.detalhe ? ` · ${x.detalhe}` : ""}</p>
                  {x.tipo !== "assinatura" && <div className="mt-1 text-[12px]"><Prazo data={x.data} /></div>}
                </li>
              ))}
              {!agenda.length && <li className="px-4 py-6 text-center text-[13px] text-tinta-500">Nada pendente.</li>}
            </ul>
          </Painel>
          <Painel titulo="Marco temporal">
            <p className="text-[13px] leading-relaxed text-tinta-700">
              Só entram na REURB núcleos informais consolidados até <b className="text-tinta-900">22/12/2016</b> (Lei 13.465/2017, art. 9º, §2º). O silêncio do notificado em 30 dias vale como concordância (art. 31, §6º).
            </p>
          </Painel>
        </div>
      </div>
    </div>
  );
}
