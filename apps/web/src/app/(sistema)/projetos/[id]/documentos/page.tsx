import { Suspense } from "react";
import clsx from "clsx";
import { FileText, PenLine } from "lucide-react";
import { CaixaMemorial } from "@/components/caixa-memorial";
import { Carregando, Etiqueta, Painel } from "@/components/ui";
import { obterProjeto } from "@/lib/dados";
import { FASES, fmt, METODO_ASSINATURA, NORMAS, SITUACAO_PECA, TIPO_DOCUMENTO, TIPOS_PECA } from "@/lib/dominio";

export const metadata = { title: "Documentos e peças" };

async function Conteudo({ params }: Pick<PageProps<"/projetos/[id]/documentos">, "params">) {
  const p = obterProjeto((await params).id)!;
  const estado = Object.fromEntries(p.pecas.map((x) => [x.tipo, x.situacao]));
  const tipos = Object.entries(TIPOS_PECA);
  const prontas = tipos.filter(([k]) => ["aprovada", "assinada"].includes(estado[k])).length;
  const porFase = FASES.map((f) => ({ fase: f, docs: p.documentos.filter((d) => d.fase === f.codigo) })).filter((x) => x.docs.length);

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <div className="space-y-4 xl:col-span-3">
        <Painel titulo="Autos do processo administrativo" aside={`${p.documentos.length} documentos, cada um com código de verificação pública`} corpo="p-0">
          {porFase.map(({ fase, docs }) => (
            <section key={fase.codigo} className="border-b border-borda last:border-b-0">
              <h3 className="bg-realce px-3.5 py-1.5 text-[13px] font-semibold text-texto-2">Fase {FASES.indexOf(fase) + 1}: {fase.nome}</h3>
              <ul className="divide-y divide-borda">
                {docs.map((d) => {
                  const pend = d.assinaturas.filter((a) => a.situacao === "pendente").length;
                  return (
                    <li key={d.id} id={d.id} className="scroll-mt-28 px-3.5 py-2.5 target:bg-azul-claro">
                      <div className="flex items-start gap-2.5">
                        <FileText className="mt-0.5 size-4 shrink-0 text-texto-3" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold">{d.titulo}</p>
                          <p className="mt-0.5 text-[12.5px] text-texto-3">
                            {d.origem === "emitido" ? "Emitido pelo sistema" : TIPO_DOCUMENTO[d.tipo]}, {fmt.data(d.data)}, {d.paginas} {d.paginas === 1 ? "página" : "páginas"}, {fmt.kb(d.tamanho_kb)}. Verificação: <span className="cod text-texto-2">{d.codigo_verificacao}</span>
                          </p>
                          {d.assinaturas.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {d.assinaturas.map((a) => (
                                <li key={a.nome + a.papel} className="flex flex-wrap items-center gap-x-2 text-[13px]">
                                  <PenLine className={clsx("size-3.5", a.situacao === "assinado" ? "text-verde" : "text-ambar")} aria-hidden />
                                  <span>{a.nome}</span>
                                  <span className="text-texto-3">{a.papel}, {METODO_ASSINATURA[a.metodo]}</span>
                                  <span className={a.situacao === "assinado" ? "text-verde" : "font-semibold text-ambar"}>{a.situacao === "assinado" ? `assinado em ${fmt.data(a.em)}` : "aguardando assinatura"}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        {pend > 0 && <Etiqueta tom="ambar">{pend} assinatura{pend > 1 ? "s" : ""} pendente{pend > 1 ? "s" : ""}</Etiqueta>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {!porFase.length && <p className="p-4 text-[13.5px] text-texto-2">Nenhum documento juntado ainda. Os documentos entram pelos autos de cada fase.</p>}
        </Painel>

        <Painel titulo="Memorial descritivo do perímetro do núcleo" aside="Gerado dos vértices do perímetro">
          <CaixaMemorial texto={p.memorial_perimetro} arquivo={`memorial-perimetro-nucleo-${p.id}`} />
        </Painel>
      </div>

      <Painel className="self-start xl:col-span-2" titulo="Peças do projeto e CRF" aside={`${prontas} de ${tipos.length} prontas`} corpo="p-0">
        <ul className="divide-y divide-borda">
          {tipos.map(([k, t]) => {
            const s = SITUACAO_PECA[estado[k] ?? "pendente"];
            return (
              <li key={k} className="flex items-start justify-between gap-3 px-3.5 py-2">
                <div className="min-w-0">
                  <p className={clsx("text-[13.5px]", estado[k] ? "text-texto" : "text-texto-2")}>{t.nome}</p>
                  <p className="text-[12.5px] text-texto-3">{t.baseLegal}{t.artRrt ? ", exige ART/RRT" : ""}</p>
                </div>
                <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-borda px-3.5 py-2.5 text-[12.5px] text-texto-3">
          Peças exigidas pelos arts. 35 e 41 da <a className="text-azul hover:underline" href={NORMAS.lei13465.url} target="_blank" rel="noreferrer">Lei 13.465/2017</a>.
        </p>
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
