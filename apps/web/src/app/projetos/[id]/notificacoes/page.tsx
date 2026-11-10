import { Suspense } from "react";
import { Carimbo, Carregando, Painel, Tabela } from "@/components/ui";
import { Prazo } from "@/components/prazo";
import { obterProjeto } from "@/lib/dados";
import { fmt, MEIO_NOTIFICACAO, PAPEL_NOTIFICADO } from "@/lib/dominio";

export const metadata = { title: "Notificações" };

const RESPOSTA = {
  sem_manifestacao: { rotulo: "sem manifestação", tom: "neutro" as const, nota: "concordância tácita" },
  anuencia: { rotulo: "anuência", tom: "oliva" as const, nota: "expressa" },
  impugnacao: { rotulo: "impugnação", tom: "carimbo" as const, nota: "abre composição de conflitos" },
};

async function Conteudo({ params }: Pick<PageProps<"/projetos/[id]/notificacoes">, "params">) {
  const p = obterProjeto((await params).id)!;
  const n = p.notificacoes;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Painel titulo="Notificações expedidas" aside={`${n.length} registros`}>
        {n.length ? (
          <Tabela cabecalho={["Destinatário", "Papel", "Meio", "Envio", "Ciência", "Fim do prazo", "Resposta"]}>
            {n.map((x) => (
              <tr key={x.destinatario} className="align-top">
                <td className="py-2.5 pr-4 whitespace-normal">
                  <span className="font-medium text-tinta-900">{x.destinatario}</span>
                  {x.impugnacao && <p className="mt-0.5 max-w-xs text-[12px] text-carimbo-600">{x.impugnacao}</p>}
                </td>
                <td className="py-2.5 pr-4 text-tinta-700">{PAPEL_NOTIFICADO[x.papel]}</td>
                <td className="py-2.5 pr-4 text-tinta-700">{MEIO_NOTIFICACAO[x.meio]}</td>
                <td className="mono py-2.5 pr-4 text-tinta-700">{fmt.data(x.enviada_em)}</td>
                <td className="mono py-2.5 pr-4 text-tinta-700">{fmt.data(x.recebida_em)}</td>
                <td className="py-2.5 pr-4"><Prazo data={x.prazo_fim} encerrado={x.resposta !== "impugnacao"} /></td>
                <td className="py-2.5"><Carimbo tom={RESPOSTA[x.resposta].tom}>{RESPOSTA[x.resposta].rotulo}</Carimbo></td>
              </tr>
            ))}
          </Tabela>
        ) : (
          <p className="text-[13px] text-tinta-500">A fase de notificações ainda não começou neste núcleo.</p>
        )}
      </Painel>
      <Painel titulo="Regra do art. 31">
        <div className="space-y-3 text-[13px] leading-relaxed text-tinta-700">
          <p>Titulares de domínio, confrontantes e terceiros são notificados por via postal com aviso de recebimento ou, se não encontrados, por edital.</p>
          <p>O prazo para impugnar é de <b className="text-tinta-900">30 dias</b> a partir do recebimento. O silêncio vale como concordância (§6º).</p>
          <p>Uma impugnação abre o procedimento extrajudicial de composição de conflitos (§3º); impugnação infundada pode ser rejeitada, com recurso em 15 dias (Dec. 9.310/2018, art. 24, §§10-12).</p>
          <p className="text-[12px] text-tinta-500">Lei 13.465/2017, art. 31; Dec. 9.310/2018, art. 24.</p>
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
