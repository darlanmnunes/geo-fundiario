import { Suspense } from "react";
import { BarrasH, Colunas } from "@/components/graficos";
import { Carregando, Painel, Rotulo } from "@/components/ui";
import { TabelaLotes, type LinhaLote } from "@/components/tabela-lotes";
import { lotesDe, obterProjeto, perfilSocioeconomico } from "@/lib/dados";
import { ESCOLARIDADE, FAIXA_IDADE, FAIXA_RENDA, SITUACAO_PROFISSIONAL } from "@/lib/dominio";

export const metadata = { title: "Cadastro" };

const rotular = (dados: { chave: string; n: number }[], rotulos: Record<string, string>, corta = "") =>
  dados.map((d) => ({ chave: d.chave, rotulo: (rotulos[d.chave] ?? d.chave).replace(corta, ""), valor: d.n }));

async function Conteudo({ params }: Pick<PageProps<"/projetos/[id]/lotes">, "params">) {
  const p = obterProjeto((await params).id)!;
  const linhas: LinhaLote[] = lotesDe(p).map((l) => ({
    codigo: l.codigo,
    quadra: l.quadra,
    area_m2: l.area_m2,
    situacao: l.situacao,
    ocupante: l.ocupante?.nome ?? null,
    cpf: l.ocupante?.cpf_mascarado ?? null,
    renda_sm: l.ocupante?.renda_sm ?? null,
    familia: l.ocupante?.composicao_familiar ?? null,
    docs_pendentes: l.ocupante?.documentos_pendentes ?? [],
    pendencias: l.pendencias.length,
  }));
  const perfil = perfilSocioeconomico(p);
  const social = p.modalidade === "reurb_s";
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <TabelaLotes projetoId={p.id} linhas={linhas} limiteRendaSm={social ? 5 : null} />
      <Painel titulo="Perfil socioeconômico" aside={`${perfil.total} famílias`}>
        <div className="space-y-5">
          <div>
            <Rotulo className="mb-2">Renda familiar, em salários mínimos</Rotulo>
            <Colunas itens={rotular(perfil.renda, FAIXA_RENDA, " SM")} destaque={social ? { chave: "acima_5", cor: "#e2780c" } : undefined} altura={90} />
          </div>
          <div>
            <Rotulo className="mb-2">Idade do responsável, em anos</Rotulo>
            <Colunas itens={rotular(perfil.idade, FAIXA_IDADE, " anos")} altura={90} />
          </div>
          <div>
            <Rotulo className="mb-1.5">Escolaridade</Rotulo>
            <BarrasH itens={rotular(perfil.escolaridade, ESCOLARIDADE)} larguraRotulo="6.5rem" />
          </div>
          <div>
            <Rotulo className="mb-1.5">Situação profissional</Rotulo>
            <BarrasH itens={rotular(perfil.profissao, SITUACAO_PROFISSIONAL)} larguraRotulo="9.5rem" />
          </div>
          {social && (
            <p className="border-t border-borda pt-3 text-[12.5px] leading-relaxed text-texto-3">
              Na REURB-S, famílias acima de 5 salários mínimos (Dec. 9.310/2018, art. 6º) aparecem em destaque e precisam de análise individual.
            </p>
          )}
        </div>
      </Painel>
    </div>
  );
}

export default function Lotes({ params }: PageProps<"/projetos/[id]/lotes">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}
