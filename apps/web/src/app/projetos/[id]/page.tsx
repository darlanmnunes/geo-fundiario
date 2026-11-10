import { Suspense } from "react";
import { Carregando } from "@/components/ui";
import { Workspace, type FaseResumo, type LoteResumo } from "@/components/workspace";
import { camadasBase, indicadores, lotesDe, lotesParaMapa, obterProjeto } from "@/lib/dados";

async function Conteudo({ params }: Pick<PageProps<"/projetos/[id]">, "params">) {
  const p = obterProjeto((await params).id)!;
  const k = indicadores(p);
  const lotes: LoteResumo[] = lotesDe(p).map((l) => ({
    codigo: l.codigo,
    quadra: l.quadra,
    situacao: l.situacao,
    area_m2: l.area_m2,
    edificado: l.edificado,
    ocupante: l.ocupante && {
      nome: l.ocupante.nome,
      renda_sm: l.ocupante.renda_sm,
      composicao_familiar: l.ocupante.composicao_familiar,
      tempo_ocupacao_anos: l.ocupante.tempo_ocupacao_anos,
      documentos_pendentes: l.ocupante.documentos_pendentes,
    },
    pendencias: l.pendencias,
  }));
  const fases: FaseResumo[] = p.fases.map((f) => ({ ...f, documentos: p.documentos.filter((d) => d.fase === f.codigo).length }));
  return (
    <Workspace
      projetoId={p.id}
      modalidade={p.modalidade}
      camadas={camadasBase(p)}
      lotesMapa={lotesParaMapa(p)}
      lotes={lotes}
      fases={fases}
      resumo={{
        familias: k.familias,
        pessoas: k.pessoas,
        areaLotes: k.areaLotes,
        docsPendentes: k.docsPendentes,
        assinaturasPendentes: k.assinaturasPendentes,
        impugnacoes: p.notificacoes.filter((n) => n.resposta === "impugnacao").length,
      }}
    />
  );
}

export default function PaginaProjeto({ params }: PageProps<"/projetos/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}
