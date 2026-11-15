import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Mapa } from "@/components/mapa";
import { CaixaMemorial } from "@/components/caixa-memorial";
import { DocumentosOcupante } from "@/components/documentos-ocupante";
import { EdicaoUnidade } from "@/components/edicao-unidade";
import { PlantaLote } from "@/components/planta-lote";
import { Aviso, Carregando, Dado, Painel, Ponto, Rotulo, Tabela, classeBotao } from "@/components/ui";
import { camadasMapa, listarProjetos, lotesDe, obterLote, obterProjeto } from "@/lib/dados";
import { erroDaNorma, erroPlanimetrico, erroPosicional, ESCOLARIDADE, fmt, fmtTolerancia, METODO_MEDICAO, rotuloComponente, NORMAS, SITUACAO_LOTE, SITUACAO_PROFISSIONAL } from "@/lib/dominio";

export function generateStaticParams() {
  return listarProjetos().flatMap((p) => lotesDe(p).map((l) => ({ id: String(p.id), codigo: l.codigo })));
}

async function Conteudo({ params }: Pick<PageProps<"/projetos/[id]/lotes/[codigo]">, "params">) {
  const { id, codigo } = await params;
  const p = obterProjeto(id)!;
  const l = obterLote(p, codigo);
  if (!l) notFound();
  const sit = SITUACAO_LOTE[l.situacao];
  const o = l.ocupante;
  const todos = lotesDe(p);
  const i = todos.findIndex((x) => x.codigo === l.codigo);
  const criterios = o && p.modalidade === "reurb_s"
    ? [
        { ok: o.renda_sm <= 5, texto: `Renda familiar de até 5 salários mínimos (${fmt.num(o.renda_sm, 1)} SM)`, base: "Dec. 9.310/2018, art. 6º" },
        { ok: !o.possui_outro_imovel, texto: "Não é proprietário exclusivo de outro imóvel urbano ou rural", base: "art. 23, §1º, I" },
        { ok: true, texto: "Não foi contemplado com legitimação anterior (declaração)", base: "art. 23, §1º, II" },
        { ok: o.uso !== "comercial", texto: o.uso === "comercial" ? "Uso não residencial: requer reconhecimento de interesse público" : "Uso residencial ou misto", base: "art. 23, §1º, III" },
      ]
    : [];
  // Vizinhos para a planta: unidades do núcleo a até 60 m do centro desta
  const ce = l.vertices.reduce((s, v) => s + v.e, 0) / l.vertices.length, cn = l.vertices.reduce((s, v) => s + v.n, 0) / l.vertices.length;
  const vizinhos = todos
    .filter((x) => x.codigo !== l.codigo && x.vertices.some((v) => Math.hypot(v.e - ce, v.n - cn) < 250))
    .map((x) => ({ codigo: x.codigo, pontos: x.vertices.map((v) => ({ e: v.e, n: v.n })) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/projetos/${p.id}/lotes`} className={classeBotao("secundario", "h-7 px-2.5")}><ArrowLeft className="size-3.5" aria-hidden /> Cadastro</Link>
          <h2 className="text-[20px] leading-tight font-semibold">
            Lote {String(l.numero).padStart(2, "0")}, Quadra {String(l.quadra).padStart(2, "0")} <span className="cod ml-1 text-[14px] font-normal text-texto-3">{l.codigo}</span>
          </h2>
          <span className="flex items-center gap-1.5 text-[14px] font-semibold"><Ponto cor={sit.cor} /> {sit.rotulo}</span>
        </div>
        <nav aria-label="Outras unidades" className="flex gap-1.5">
          {i > 0 && <Link href={`/projetos/${p.id}/lotes/${todos[i - 1].codigo}`} className={classeBotao("secundario", "h-7 px-2.5")}>Anterior</Link>}
          {i < todos.length - 1 && <Link href={`/projetos/${p.id}/lotes/${todos[i + 1].codigo}`} className={classeBotao("secundario", "h-7 px-2.5")}>Próxima</Link>}
        </nav>
      </div>

      {l.pendencias.length > 0 && (
        <Aviso tom="ambar">
          <b>{l.pendencias.length === 1 ? "Pendência em aberto" : `${l.pendencias.length} pendências em aberto`}</b>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-texto">{l.pendencias.map((x) => <li key={x}>{x}</li>)}</ul>
        </Aviso>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Mapa camadas={camadasMapa([p])} destaque={`${p.id}:${l.codigo}`} ocultas={[]} className="h-80 lg:col-span-3 lg:h-auto lg:min-h-[420px]" />
        <div className="space-y-4 lg:col-span-2">
          <Painel titulo="Imóvel">
            <dl className="grid grid-cols-2 gap-3">
              <Dado rotulo="Área no plano UTM" cod>{fmt.num(l.area_m2)} m²</Dado>
              <Dado rotulo="Área no plano topográfico local" cod>{fmt.num(l.area_sgl_m2)} m²</Dado>
              <Dado rotulo="Perímetro (UTM / local)" cod>{fmt.num(l.perimetro_m)} / {fmt.num(l.perimetro_sgl_m)} m</Dado>
              <Dado rotulo="Vértices" cod>{l.vertices.length}</Dado>
            </dl>
            <p className="mt-2.5 border-t border-borda pt-2.5 text-[12.5px] leading-relaxed text-texto-3">
              A área no plano UTM traz a deformação da projeção (fator de escala {fmt.num(p.cartografia.fator_escala, 6)} neste núcleo). No Sistema Geodésico Local (NBR 14166 e NBR 17047) ela é calculada no plano tangente à altitude média de {fmt.num(p.cartografia.altitude_media, 0)} m. Este projeto emite as peças no plano {p.plano_calculo === "sgl" ? "topográfico local" : "UTM"}.
            </p>
          </Painel>
          <Painel titulo="Ocupante e cadastro social">
            {o ? (
              <div className="space-y-3.5 text-[13.5px]">
                <div>
                  <p className="text-[15px] font-semibold">{o.nome}</p>
                  <p className="text-texto-3">CPF <span className="cod">{o.cpf_mascarado}</span></p>
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  <Dado rotulo="Renda familiar" cod>{fmt.moeda(o.renda_familiar)}</Dado>
                  <Dado rotulo="Composição familiar">{o.composicao_familiar} {o.composicao_familiar === 1 ? "pessoa" : "pessoas"}</Dado>
                  <Dado rotulo="Tempo de ocupação">{o.tempo_ocupacao_anos} anos</Dado>
                  <Dado rotulo="Uso do imóvel" className="capitalize">{o.uso}</Dado>
                  <Dado rotulo="Idade e escolaridade">{o.idade ?? "sem dado"} anos, {ESCOLARIDADE[o.escolaridade]?.toLowerCase()}</Dado>
                  <Dado rotulo="Situação profissional">{SITUACAO_PROFISSIONAL[o.situacao_profissional]}</Dado>
                </dl>
                {criterios.length > 0 && (
                  <div className="border-t border-borda pt-3">
                    <Rotulo className="mb-1.5">Critérios da legitimação fundiária na REURB-S (<a className="text-azul hover:underline" href={NORMAS.lei13465.url} target="_blank" rel="noreferrer">Lei 13.465/2017, art. 23</a>)</Rotulo>
                    <ul className="space-y-1.5">
                      {criterios.map((c) => (
                        <li key={c.texto} className="flex gap-2">
                          {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-verde" aria-label="Atende" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-vermelho" aria-label="Não atende" />}
                          <span><span className={clsx(!c.ok && "font-semibold text-vermelho")}>{c.texto}</span> <span className="text-[12.5px] text-texto-3">({c.base})</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[13.5px] text-texto-2">Sem ocupante identificado no cadastro social. Unidades não ocupadas seguem o art. 54 da Lei 13.465/2017.</p>
            )}
          </Painel>
        </div>
      </div>

      <Painel
        titulo={`Vértices e lados (SIRGAS 2000, UTM fuso ${p.cartografia.fuso} S)`}
        aside={<>Tolerância de {fmtTolerancia(p.precisao.tolerancia_m)} no erro {rotuloComponente(p.precisao)} ({p.precisao.base_legal})</>}
        corpo="p-0"
      >
        <Tabela cabecalho={["Vértice", "E (m)", "N (m)", "h (m)", "Método", "Erro planimétrico", "Erro tridimensional", "Azimute ao próximo", "Distância", "Confrontante"]}>
          {l.vertices.map((v, j) => {
            const s = l.segmentos[j];
            const erro = erroDaNorma(v, p.precisao);
            const tri = p.precisao.componente === "tridimensional";
            return (
              <tr key={v.codigo} className="hover:bg-realce">
                <td className="cod px-3 py-1.5 font-medium">{v.codigo}</td>
                <td className="cod px-3 py-1.5 text-right">{fmt.num(v.e, 3)}</td>
                <td className="cod px-3 py-1.5 text-right">{fmt.num(v.n, 3)}</td>
                <td className="cod px-3 py-1.5 text-right">{fmt.num(v.h, 3)}</td>
                <td className="px-3 py-1.5 text-texto-2">{METODO_MEDICAO[v.metodo] ?? v.metodo}</td>
                {[erroPlanimetrico(v), erroPosicional(v)].map((x, k) => {
                  const avaliado = tri === (k === 1);
                  return (
                    <td key={k} className={clsx("cod px-3 py-1.5 text-right", !avaliado ? "text-texto-2" : erro > p.precisao.tolerancia_m ? "font-medium text-vermelho" : "text-verde")}>
                      {fmt.num(x * 100, 1)} cm{avaliado && erro > p.precisao.tolerancia_m ? " (acima)" : ""}
                    </td>
                  );
                })}
                <td className="cod px-3 py-1.5 text-right">{fmt.gms(s.azimute)}</td>
                <td className="cod px-3 py-1.5 text-right">{fmt.num(s.distancia, 3)} m</td>
                <td className="px-3 py-1.5 text-texto-2">{s.confrontante}</td>
              </tr>
            );
          })}
        </Tabela>
      </Painel>

      {o && (
        <Painel titulo="Documentos do ocupante" aside={`${o.arquivos.length} juntados${o.documentos_pendentes.length ? `, ${o.documentos_pendentes.length} obrigatório(s) faltando` : ""}`} id="documentos">
          <DocumentosOcupante arquivos={o.arquivos} faltando={o.documentos_pendentes} ocupante={o.nome} projetoId={p.id} partyRef={{ entidade: "spatialunit", id: l.id }} />
        </Painel>
      )}

      <Painel titulo="Corrigir dados desta unidade" aside="Gravação direta no banco, com registro de autor e data" id="edicao">
        <EdicaoUnidade unidadeId={l.id} />
      </Painel>

      <Painel titulo="Planta da unidade" aside="Gerada dos vértices cadastrados, em folha A3" id="planta">
        <PlantaLote
          dados={{
            arquivo: `planta-nucleo-${p.id}-${l.codigo}`,
            titulo: `Lote ${String(l.numero).padStart(2, "0")}`,
            imovel: `${p.nome}, Lote ${String(l.numero).padStart(2, "0")}, Quadra ${String(l.quadra).padStart(2, "0")}`,
            localizacao: `${p.municipio} - ${p.uf}`,
            ocupante: o?.nome ?? null,
            responsavel: p.responsavel_tecnico.split(" — ")[0],
            art: p.art_rrt,
            area_m2: p.plano_calculo === "sgl" ? l.area_sgl_m2 : l.area_m2,
            perimetro_m: p.plano_calculo === "sgl" ? l.perimetro_sgl_m : l.perimetro_m,
            planoArea: p.plano_calculo === "sgl" ? "plano topográfico local (SGL)" : "plano UTM",
            gpkg: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/dados/nucleo-${p.id}.gpkg`,
            data: p.levantamento.data_fim,
            fuso: p.cartografia.fuso,
            meridianoCentral: p.cartografia.meridiano_central,
            convergenciaGraus: p.cartografia.convergencia_graus,
            fatorEscala: p.cartografia.fator_escala,
            pontos: l.vertices.map((v) => ({ codigo: v.codigo, e: v.e, n: v.n })),
            segmentos: l.segmentos,
            vizinhos,
          }}
        />
      </Painel>

      <Painel titulo="Memorial descritivo" aside="Gerado dos vértices medidos" id="memorial">
        <CaixaMemorial texto={l.memorial} arquivo={`memorial-nucleo-${p.id}-${l.codigo}`} />
      </Painel>
    </div>
  );
}

export default function FichaLote({ params }: PageProps<"/projetos/[id]/lotes/[codigo]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}
