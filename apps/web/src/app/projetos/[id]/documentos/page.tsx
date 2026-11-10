import { Suspense } from "react";
import clsx from "clsx";
import { FileText, PenLine, QrCode } from "lucide-react";
import { CaixaMemorial } from "@/components/caixa-memorial";
import { Carimbo, Carregando, Painel, Rotulo } from "@/components/ui";
import { obterProjeto } from "@/lib/dados";
import { FASES, fmt, METODO_ASSINATURA, SITUACAO_PECA, TIPO_DOCUMENTO, TIPOS_PECA } from "@/lib/dominio";

export const metadata = { title: "Documentos e peças" };

async function Conteudo({ params }: Pick<PageProps<"/projetos/[id]/documentos">, "params">) {
  const p = obterProjeto((await params).id)!;
  const estado = Object.fromEntries(p.pecas.map((x) => [x.tipo, x.situacao]));
  const tipos = Object.entries(TIPOS_PECA);
  const prontas = tipos.filter(([k]) => ["aprovada", "assinada"].includes(estado[k])).length;
  const porFase = FASES.map((f) => ({ fase: f, docs: p.documentos.filter((d) => d.fase === f.codigo) })).filter((x) => x.docs.length);

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <div className="space-y-5 xl:col-span-3">
        <Painel titulo="Autos do processo administrativo" aside={`${p.documentos.length} documentos · cada um com código de verificação pública`} corpo="p-0">
          {porFase.map(({ fase, docs }) => (
            <div key={fase.codigo} className="border-b fio last:border-b-0">
              <div className="flex items-baseline gap-2 bg-papel-100/60 px-4 py-1.5">
                <span className="tab text-[11px] text-tinta-500">{String(FASES.indexOf(fase) + 1).padStart(2, "0")}</span>
                <span className="text-[12.5px] font-medium">{fase.nome}</span>
              </div>
              <ul className="divide-y divide-[color:var(--linha)]">
                {docs.map((d) => {
                  const pend = d.assinaturas.filter((a) => a.situacao === "pendente").length;
                  return (
                    <li key={d.id} id={d.id} className="scroll-mt-24 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 size-4 shrink-0 text-tinta-300" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[13.5px] font-medium text-tinta-900">{d.titulo}</p>
                            <Carimbo tom={d.origem === "emitido" ? "terra" : "neutro"}>{d.origem === "emitido" ? "emitido pelo sistema" : TIPO_DOCUMENTO[d.tipo]}</Carimbo>
                          </div>
                          <p className="mono mt-0.5 text-[11.5px] text-tinta-500">
                            {fmt.data(d.data)} · {d.paginas} p. · {fmt.kb(d.tamanho_kb)} · <QrCode className="inline size-3" /> {d.codigo_verificacao}
                          </p>
                          {d.assinaturas.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {d.assinaturas.map((a) => (
                                <li key={a.nome + a.papel} className="flex flex-wrap items-center gap-x-2 text-[12px]">
                                  <PenLine className={clsx("size-3", a.situacao === "assinado" ? "text-oliva-700" : "text-ocre-700")} />
                                  <span className="text-tinta-900">{a.nome}</span>
                                  <span className="text-tinta-500">{a.papel} · {METODO_ASSINATURA[a.metodo]}</span>
                                  <span className={clsx("tab", a.situacao === "assinado" ? "text-oliva-700" : "text-ocre-700")}>{a.situacao === "assinado" ? `assinado em ${fmt.data(a.em)}` : "aguardando assinatura"}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        {pend > 0 && <Carimbo tom="ocre">{pend} assinatura pendente</Carimbo>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!porFase.length && <p className="p-6 text-[13px] text-tinta-500">Nenhum documento juntado.</p>}
        </Painel>

        <Painel titulo="Memorial descritivo do perímetro do núcleo">
          <CaixaMemorial texto={p.memorial_perimetro} arquivo={`memorial-perimetro-${p.id}.txt`} />
        </Painel>
      </div>

      <Painel className="xl:col-span-2 self-start" titulo="Peças do projeto (art. 35) e CRF" aside={`${prontas}/${tipos.length} prontas`} corpo="p-0">
        <ul className="divide-y divide-[color:var(--linha)]">
          {tipos.map(([k, t]) => {
            const s = SITUACAO_PECA[estado[k] ?? "pendente"];
            return (
              <li key={k} className="flex items-start justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className={clsx("text-[13px]", estado[k] ? "text-tinta-900" : "text-tinta-500")}>{t.nome}</p>
                  <Rotulo className="mt-0.5 normal-case tracking-normal">Lei 13.465/2017, {t.baseLegal}{t.artRrt ? " · ART/RRT" : ""}</Rotulo>
                </div>
                <span className={clsx("carimbo", s.classe)}>{s.rotulo}</span>
              </li>
            );
          })}
        </ul>
      </Painel>
    </div>
  );
}

export default function Documentos({ params }: PageProps<"/projetos/[id]/documentos">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}
