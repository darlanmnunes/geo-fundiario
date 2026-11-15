import { Suspense } from "react";
import { Carregando, Etiqueta, Painel, Tabela } from "@/components/ui";
import { Prazo } from "@/components/prazo";
import { obterProjeto } from "@/lib/dados";
import { fmt, MEIO_NOTIFICACAO, NORMAS, PAPEL_NOTIFICADO, type Tom } from "@/lib/dominio";

export const metadata = { title: "Notificações" };

const RESPOSTA: Record<string, { rotulo: string; tom: Tom }> = {
  sem_manifestacao: { rotulo: "Sem manifestação (concordância)", tom: "neutro" },
  anuencia: { rotulo: "Anuência expressa", tom: "verde" },
  impugnacao: { rotulo: "Impugnação", tom: "vermelho" },
  aguardando: { rotulo: "Prazo correndo", tom: "ambar" },
};

async function Conteudo({ params }: Pick<PageProps<"/projetos/[id]/notificacoes">, "params">) {
  const p = obterProjeto((await params).id)!;
  const n = p.notificacoes;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Painel titulo="Notificações expedidas" aside={`${n.length} ${n.length === 1 ? "registro" : "registros"}`} corpo="p-0">
        {n.length ? (
          <Tabela cabecalho={["Destinatário", "Papel", "Meio", "Envio", "Ciência", "Fim do prazo", "Resposta"]}>
            {n.map((x) => {
              const r = RESPOSTA[x.resposta ?? "aguardando"];
              return (
                <tr key={x.destinatario} className="align-top hover:bg-realce">
                  <td className="px-3 py-2.5 whitespace-normal">
                    <span className="font-semibold">{x.destinatario}</span>
                    {x.impugnacao && <p className="mt-0.5 max-w-xs text-[13px] text-vermelho">{x.impugnacao}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-texto-2">{PAPEL_NOTIFICADO[x.papel]}</td>
                  <td className="px-3 py-2.5 text-texto-2">{MEIO_NOTIFICACAO[x.meio]}</td>
                  <td className="px-3 py-2.5 text-texto-2">{fmt.data(x.enviada_em)}</td>
                  <td className="px-3 py-2.5 text-texto-2">{fmt.data(x.recebida_em)}</td>
                  <td className="px-3 py-2.5"><Prazo data={x.prazo_fim} encerrado={x.resposta !== null && x.resposta !== "impugnacao"} /></td>
                  <td className="px-3 py-2.5"><Etiqueta tom={r.tom}>{r.rotulo}</Etiqueta></td>
                </tr>
              );
            })}
          </Tabela>
        ) : (
          <p className="p-4 text-[13.5px] text-texto-2">A fase de buscas e notificações ainda não começou neste núcleo. Ela vem depois do levantamento de campo.</p>
        )}
      </Painel>
      <Painel titulo="Como funciona a notificação">
        <div className="space-y-2.5 text-[13.5px] leading-relaxed text-texto-2">
          <p>Titulares de domínio, confrontantes e terceiros são notificados por via postal com aviso de recebimento ou, se não encontrados, por edital.</p>
          <p>O prazo para impugnar é de <b className="text-texto">30 dias</b> a partir do recebimento. O silêncio vale como concordância (art. 31, §6º).</p>
          <p>Uma impugnação abre o procedimento extrajudicial de composição de conflitos (§3º). Impugnação infundada pode ser rejeitada, com recurso em 15 dias.</p>
          <p className="text-[13px]">
            <a className="text-azul hover:underline" href={NORMAS.lei13465.url} target="_blank" rel="noreferrer">Lei 13.465/2017, art. 31</a> e <a className="text-azul hover:underline" href={NORMAS.dec9310.url} target="_blank" rel="noreferrer">Decreto 9.310/2018, art. 24</a>
          </p>
        </div>
      </Painel>
    </div>
  );
}

export default function Notificacoes({ params }: PageProps<"/projetos/[id]/notificacoes">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}
