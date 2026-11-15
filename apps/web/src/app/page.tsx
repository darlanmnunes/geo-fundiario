import { PainelGeral, type ItemAgenda, type NucleoResumo, type UnidadeResumo } from "@/components/painel-geral";
import { Cabecalho, Pagina } from "@/components/ui";
import { camadasMapa, faixaIdade, faixaRenda, indicadores, listarProjetos, lotesDe } from "@/lib/dados";
import { fasePorCodigo, fmtTolerancia } from "@/lib/dominio";

export default function VisaoGeral() {
  const projetos = listarProjetos();
  const nucleos: NucleoResumo[] = projetos.map((p) => {
    const k = indicadores(p);
    return {
      id: p.id,
      nome: p.nome,
      modalidade: p.modalidade,
      processo: p.processo_adm,
      faseAtual: p.fase_atual,
      fases: p.fases.map((f) => ({ codigo: f.codigo, situacao: f.situacao })),
      prazo: p.fases.find((f) => f.situacao === "em_andamento" && f.prazo_em)?.prazo_em ?? null,
      vertices: k.vertices,
      verticesFora: k.verticesFora,
      aptidao: p.dossie?.pontuacao ?? null,
      tolerancia: fmtTolerancia(p.precisao.tolerancia_m),
    };
  });
  const unidades: UnidadeResumo[] = projetos.flatMap((p) =>
    lotesDe(p).map((l) => ({
      projeto: p.id,
      situacao: l.situacao,
      pendencias: l.pendencias.length,
      pessoas: l.ocupante?.composicao_familiar ?? 0,
      renda: l.ocupante ? faixaRenda(l.ocupante.renda_sm) : null,
      idade: l.ocupante?.idade != null ? faixaIdade(l.ocupante.idade) : null,
      escolaridade: l.ocupante?.escolaridade ?? null,
      profissao: l.ocupante?.situacao_profissional ?? null,
      docsFaltando: l.ocupante?.documentos_pendentes.length ?? 0,
    })),
  );
  const agenda: ItemAgenda[] = projetos.flatMap((p) => {
    const k = indicadores(p);
    const itens: ItemAgenda[] = [
      ...p.fases.filter((f) => f.prazo_em && f.situacao === "em_andamento").map((f) => ({
        projeto: p.id, nucleo: p.nome, tipo: "prazo" as const, href: `/projetos/${p.id}#fase-${f.codigo}`,
        texto: `${fasePorCodigo[f.codigo].nome}: prazo legal de ${fasePorCodigo[f.codigo].prazoDias} dias`, data: f.prazo_em!,
      })),
      ...p.notificacoes.filter((n) => n.resposta === "impugnacao").map((n) => ({
        projeto: p.id, nucleo: p.nome, tipo: "impugnacao" as const, href: `/projetos/${p.id}/notificacoes`,
        texto: `Impugnação de ${n.destinatario}`, detalhe: n.impugnacao ?? undefined,
      })),
      ...p.documentos.flatMap((d) => d.assinaturas.filter((a) => a.situacao === "pendente").map((a) => ({
        projeto: p.id, nucleo: p.nome, tipo: "assinatura" as const, href: `/projetos/${p.id}/documentos#${d.id}`,
        texto: d.titulo, detalhe: `aguarda ${a.papel.toLowerCase()}`,
      }))),
    ];
    if (k.verticesFora) itens.push({ projeto: p.id, nucleo: p.nome, tipo: "vertices", href: `/projetos/${p.id}/levantamento`, texto: `${k.verticesFora} vértices acima de ${fmtTolerancia(p.precisao.tolerancia_m)}`, detalhe: "exigem nova medição" });
    return itens;
  });

  return (
    <Pagina>
      <Cabecalho
        titulo="Visão geral"
        descricao="Situação de todos os núcleos em regularização fundiária urbana (REURB): onde cada processo está, o que falta e o que depende de decisão."
      />
      <div className="mt-4">
        <PainelGeral nucleos={nucleos} unidades={unidades} agenda={agenda} camadas={camadasMapa(projetos)} />
      </div>
    </Pagina>
  );
}
