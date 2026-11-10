import { Suspense } from "react";
import { Carregando, Painel, Rotulo } from "@/components/ui";
import { TabelaLotes, type LinhaLote } from "@/components/tabela-lotes";
import { lotesDe, obterProjeto, perfilSocioeconomico } from "@/lib/dados";
import { ESCOLARIDADE, SITUACAO_PROFISSIONAL } from "@/lib/dominio";

export const metadata = { title: "Cadastro" };

const ROTULO_RENDA: Record<string, string> = { ate_1: "até 1 SM", "1_2": "1–2", "2_3": "2–3", "3_5": "3–5", acima_5: "> 5 SM" };
const ROTULO_IDADE: Record<string, string> = { ate_29: "até 29", "30_44": "30–44", "45_59": "45–59", "60_mais": "60+" };

function Barras({ titulo, dados, rotulos, destaque }: { titulo: string; dados: { chave: string; n: number }[]; rotulos: Record<string, string>; destaque?: string }) {
  const max = Math.max(1, ...dados.map((d) => d.n));
  return (
    <div>
      <Rotulo className="mb-2">{titulo}</Rotulo>
      <ul className="space-y-1.5">
        {dados.map((d) => (
          <li key={d.chave} className="grid grid-cols-[88px_1fr_28px] items-center gap-2 text-[12px]">
            <span className="truncate text-tinta-700">{rotulos[d.chave] ?? d.chave}</span>
            <span className="h-2 rounded-[1px] bg-papel-200"><span className={d.chave === destaque ? "block h-full bg-carimbo-600" : "block h-full bg-tinta-700"} style={{ width: `${(d.n / max) * 100}%` }} /></span>
            <span className="tab text-right text-tinta-900">{d.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <TabelaLotes projetoId={p.id} linhas={linhas} limiteRendaSm={p.modalidade === "reurb_s" ? 5 : null} />
      <Painel titulo="Perfil socioeconômico" aside={`${perfil.total} famílias`}>
        <div className="space-y-5">
          <Barras titulo="Renda familiar" dados={perfil.renda} rotulos={ROTULO_RENDA} destaque={p.modalidade === "reurb_s" ? "acima_5" : undefined} />
          <Barras titulo="Idade do responsável" dados={perfil.idade} rotulos={ROTULO_IDADE} />
          <Barras titulo="Escolaridade" dados={perfil.escolaridade} rotulos={ESCOLARIDADE} />
          <Barras titulo="Situação profissional" dados={perfil.profissao} rotulos={SITUACAO_PROFISSIONAL} />
          {p.modalidade === "reurb_s" && (
            <p className="border-t fio pt-3 text-[12px] leading-relaxed text-tinta-500">
              Na REURB-S, famílias acima de 5 salários mínimos (Dec. 9.310/2018, art. 6º) aparecem em vermelho e precisam de análise individual.
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
