"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Download, ExternalLink, FileUp, MapPinned, RefreshCw, Save } from "lucide-react";
import { Mapa } from "./mapa";
import { Aviso, Etiqueta, FaixaIndicadores, Indicador, Painel, classeBotao } from "./ui";
import { baixarBlob } from "@/lib/arquivos";
import type { CamadaCatalogo, CamadasMapa } from "@/lib/dados";
import { normaCitada } from "@/lib/dominio";
import { ORDEM_SEVERIDADE, SEVERIDADE, type Achado, type Diagnostico, type Severidade } from "@/lib/inteligencia";
import { api, podeEditar, TEM_API, useSessao } from "@/lib/sessao";

interface Nucleo { id: number; nome: string; municipio: string; area_ha: number; unidades: number }
type Alvo = number | "livre";

const ROTULO_METRICA: Record<string, string> = {
  distancia_min_m: "Distância mínima (m)", unidades_na_faixa: "Unidades na faixa", faixa_m: "Faixa considerada (m)", feicoes: "Feições analisadas",
  trechos: "Trechos no entorno", curso_mais_proximo: "Curso d'água mais próximo", dominialidade: "Dominialidade", setores: "Setores",
  unidades_atingidas: "Unidades atingidas", area_sobreposta_m2: "Área sobreposta (m²)", ano: "Ano do mapeamento", pct_area_urbanizada: "Área urbanizada (%)",
  favelas_comunidades: "Favelas e comunidades urbanas", populacao: "População", domicilios: "Domicílios ocupados", moradores_por_domicilio: "Moradores por domicílio",
  densidade_hab_km2: "Densidade (hab/km²)", imoveis: "Imóveis", imoveis_no_entorno: "Imóveis no entorno", sobrepostos: "Sobrepostos", no_entorno: "No entorno",
  bens: "Bens", processos: "Processos", rodovia_federal_m: "Rodovia federal (m)", dup: "Declarações de utilidade pública", setores_no_entorno: "Setores no entorno",
  erro: "Erro",
};

const fmtValor = (v: unknown): string =>
  v == null ? "sem informação" : Array.isArray(v) ? (v.length ? v.join(", ") : "nenhum") : typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : String(v);

/** Aceita Feature, FeatureCollection ou geometria solta; devolve o primeiro polígono. */
function lerPoligono(texto: string): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
  let dado: GeoJSON.GeoJSON;
  try {
    dado = JSON.parse(texto);
  } catch {
    throw new Error("O conteúdo não é um GeoJSON válido.");
  }
  const candidatos: (GeoJSON.Geometry | null)[] = dado.type === "FeatureCollection" ? dado.features.map((f) => f.geometry) : dado.type === "Feature" ? [dado.geometry] : [dado];
  const g = candidatos.find((x) => x && (x.type === "Polygon" || x.type === "MultiPolygon")) as GeoJSON.Polygon | GeoJSON.MultiPolygon | undefined;
  if (!g) throw new Error("O arquivo não tem polígono. A área de estudo precisa ser um polígono em graus (longitude, latitude).");
  return { type: "Feature", geometry: g, properties: {} };
}

export function DiagnosticoTerritorial({ nucleos, camadas, catalogo }: { nucleos: Nucleo[]; camadas: CamadasMapa; catalogo: CamadaCatalogo[] }) {
  const sessao = useSessao();
  const [alvo, setAlvo] = useState<Alvo>(nucleos[0]?.id ?? "livre");
  const [texto, setTexto] = useState("");
  const [area, setArea] = useState<GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null>(null);
  const [resultados, setResultados] = useState<Record<string, Diagnostico>>({});
  const [estado, setEstado] = useState<"parado" | "consultando" | "gravando">("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [so, setSo] = useState<Severidade | null>(null);
  const [noMapa, setNoMapa] = useState<string | null>(null);

  const nucleo = typeof alvo === "number" ? nucleos.find((n) => n.id === alvo) : undefined;
  const r = resultados[String(alvo)];
  const achados = useMemo(() => (r ? [...r.achados].sort((a, b) => ORDEM_SEVERIDADE.indexOf(a.severidade) - ORDEM_SEVERIDADE.indexOf(b.severidade)) : []), [r]);
  const conta = (s: Severidade) => achados.filter((a) => a.severidade === s).length;
  const responderam = achados.length - conta("sem_dado");
  const maisLenta = achados.reduce((m, a) => Math.max(m, a.tempo_ms ?? 0), 0);
  const evidencias: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: achados.filter((a) => !noMapa || a.camada === noMapa).flatMap((a) => a.evidencias ?? []) };
  const ligados = catalogo.filter((c) => c.situacao === "ao_vivo").length;

  const trocar = (novo: Alvo) => {
    setAlvo(novo);
    setErro(null);
    setAviso(null);
    setSo(null);
    setNoMapa(null);
  };
  const carregarTexto = (bruto: string) => {
    setTexto(bruto);
    setErro(null);
    if (!bruto.trim()) return setArea(null);
    try {
      setArea(lerPoligono(bruto));
    } catch (e) {
      setArea(null);
      setErro(e instanceof Error ? e.message : "GeoJSON inválido.");
    }
  };
  const consultar = async () => {
    setEstado("consultando");
    setErro(null);
    setAviso(null);
    try {
      const resp = typeof alvo === "number"
        ? await api<Diagnostico>(`/projetos/${alvo}/diagnostico`)
        : await api<Diagnostico>("/diagnostico/area", { corpo: { geometria: area?.geometry } });
      setResultados((x) => ({ ...x, [String(alvo)]: resp }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "A consulta falhou.");
    } finally {
      setEstado("parado");
    }
  };
  const gravar = async () => {
    setEstado("gravando");
    setErro(null);
    try {
      const resp = await api<{ gravados: number; pontuacao: number; sem_resposta: string[] }>(`/projetos/${alvo}/diagnostico/gravar`, { metodo: "POST" });
      setAviso(`${resp.gravados} tema(s) gravados no dossiê do núcleo; nota de aptidão recalculada para ${resp.pontuacao} de 100.${resp.sem_resposta.length ? ` Sem resposta agora, mantidos como estavam: ${resp.sem_resposta.join(", ")}.` : ""}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gravar.");
    } finally {
      setEstado("parado");
    }
  };
  const baixar = () => r && baixarBlob(`diagnostico-${nucleo ? nucleo.nome.toLowerCase().replace(/\s+/g, "-") : "area-livre"}.json`, new Blob([JSON.stringify({ area: nucleo?.nome ?? "Área livre", ...r }, null, 2)], { type: "application/json" }));

  const aba = (v: Alvo, rotulo: string) => (
    <button key={String(v)} type="button" role="tab" aria-selected={alvo === v} onClick={() => trocar(v)}
      className={clsx("h-9 flex-1 border-r border-borda px-3 text-[13.5px] whitespace-nowrap last:border-r-0", alvo === v ? "bg-azul font-semibold text-white" : "text-texto hover:bg-realce")}>
      {rotulo}
    </button>
  );
  const podeConsultar = TEM_API && estado === "parado" && (typeof alvo === "number" || area !== null);

  return (
    <div className="space-y-4">
      <Painel titulo="Área de estudo" aside={nucleo ? `${nucleo.municipio}, ${nucleo.unidades} unidades, ${nucleo.area_ha.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha` : r?.area_ha ? `${r.area_ha.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha${r.uf ? `, ${r.uf}` : ""}` : "polígono importado"}>
        <div role="tablist" aria-label="Área de estudo" className="flex flex-wrap overflow-hidden rounded border border-borda-forte bg-superficie">
          {nucleos.map((n) => aba(n.id, n.nome.replace("Núcleo ", "")))}
          {aba("livre", "Outra área")}
        </div>
        {alvo === "livre" && (
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="text-[13.5px] leading-relaxed text-texto-2">
              <p>Importe um polígono em GeoJSON, em graus (SIRGAS 2000 ou WGS 84), de qualquer lugar do Brasil, com até 5.000 ha. O QGIS exporta nesse formato em Exportar, Salvar feições como, GeoJSON.</p>
              <label className={classeBotao("secundario", "mt-2 cursor-pointer")}>
                <FileUp className="size-4" aria-hidden /> Escolher arquivo
                <input type="file" accept=".geojson,.json,application/geo+json,application/json" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) carregarTexto(await f.text()); }} />
              </label>
              {area && <p className="mt-2 text-verde">Polígono lido. Ele aparece no mapa em tracejado azul.</p>}
            </div>
            <label className="block text-[13px] font-semibold">Ou cole o GeoJSON aqui
              <textarea value={texto} onChange={(e) => carregarTexto(e.target.value)} rows={5} spellCheck={false} placeholder='{"type": "Polygon", "coordinates": [[[-42.875, -20.762], ...]]}' className="cod mt-1 block w-full rounded border border-borda-forte bg-superficie p-2 text-[12.5px] font-normal" />
            </label>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={consultar} disabled={!podeConsultar} className={classeBotao("primario")}>
            <RefreshCw className={clsx("size-4", estado === "consultando" && "animate-spin")} aria-hidden /> {estado === "consultando" ? "Consultando as fontes" : "Consultar as fontes agora"}
          </button>
          {r && <button type="button" onClick={baixar} className={classeBotao("secundario")}><Download className="size-4" aria-hidden /> Baixar o resultado</button>}
          {r && nucleo && podeEditar(sessao?.usuario) && (
            <button type="button" onClick={gravar} disabled={estado !== "parado"} className={classeBotao("secundario")}>
              <Save className="size-4" aria-hidden /> {estado === "gravando" ? "Gravando" : "Gravar no dossiê do núcleo"}
            </button>
          )}
          <span className="text-[13px] text-texto-3" role="status">
            {estado === "consultando" ? `Consultando ${ligados} fontes em paralelo. Leva até meio minuto.` : r ? `Consultado em ${new Date(r.consultado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.` : TEM_API ? `${ligados} fontes ligadas. Nada é gravado até você pedir.` : ""}
          </span>
        </div>
        <div aria-live="polite">
          {erro && <p role="alert" className="mt-3 text-[13.5px] text-vermelho">{erro}</p>}
          {aviso && <p className="mt-3 text-[13.5px] text-verde">{aviso} <Link href="/inteligencia" className="font-semibold underline">Ver na Inteligência territorial</Link></p>}
        </div>
        {r && nucleo && !podeEditar(sessao?.usuario) && <p className="mt-2 text-[12.5px] text-texto-3">Para gravar o resultado no dossiê do núcleo é preciso entrar com perfil de editor.</p>}
      </Painel>

      {!TEM_API && (
        <Aviso tom="azul">
          A demonstração pública não tem servidor para consultar as fontes. Na instalação com a API, esta página consulta em tempo real as {ligados} fontes ligadas da tabela abaixo, para um núcleo cadastrado ou para qualquer polígono importado.
        </Aviso>
      )}

      {r && (
        <FaixaIndicadores className="grid-cols-2 md:grid-cols-5">
          <Indicador rotulo="Fontes que responderam" valor={`${responderam} de ${achados.length}`} nota={maisLenta ? `a mais lenta levou ${(maisLenta / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s` : undefined} />
          <Indicador rotulo="Impedem" valor={conta("impede")} tom={conta("impede") ? "vermelho" : "neutro"} nota="barram até serem resolvidos" />
          <Indicador rotulo="Condicionam" valor={conta("condiciona")} tom={conta("condiciona") ? "ambar" : "neutro"} nota="exigem estudo, obra ou ato" />
          <Indicador rotulo="Pedem atenção" valor={conta("atencao")} tom={conta("atencao") ? "azul" : "neutro"} nota="registrar e acompanhar" />
          <Indicador rotulo="Sem restrição" valor={conta("ok")} tom="verde" nota="nada a fazer" />
        </FaixaIndicadores>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Mapa camadas={camadas} foco={typeof alvo === "number" ? alvo : null} areaEstudo={alvo === "livre" ? area : null} evidencias={evidencias} ocultas={["logradouros", "app"]} rotuloNucleo className="h-[420px] xl:sticky xl:top-16 xl:h-[calc(100vh-6rem)] xl:min-h-[520px]" />
          <p className="mt-1.5 text-[12.5px] text-texto-3">Em laranja, as feições devolvidas pelas fontes. {noMapa ? `Mostrando só as de "${noMapa}".` : "Cada tema tem um botão para isolar as suas no mapa."}</p>
        </div>

        <div className="min-w-0 space-y-3">
          {!r && TEM_API && <Painel><p className="text-[13.5px] leading-relaxed text-texto-2">Escolha a área e consulte as fontes. Cada tema volta com o resultado, a consequência prática, a base legal, a fonte, os números medidos e as feições encontradas.</p></Painel>}
          {r && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12.5px] text-texto-3">Filtrar</span>
              {ORDEM_SEVERIDADE.filter((s) => conta(s)).map((s) => (
                <button key={s} type="button" onClick={() => setSo(so === s ? null : s)} aria-pressed={so === s} title={SEVERIDADE[s].explicacao} className={clsx("rounded-[3px]", so && so !== s && "opacity-40", so === s && "ring-2 ring-azul ring-offset-1")}>
                  <Etiqueta tom={SEVERIDADE[s].tom}>{SEVERIDADE[s].rotulo} <span className="num">{conta(s)}</span></Etiqueta>
                </button>
              ))}
            </div>
          )}
          {achados.filter((a) => !so || a.severidade === so).map((a) => <Tema key={a.codigo ?? a.camada} a={a} isolado={noMapa === a.camada} aoIsolar={() => setNoMapa(noMapa === a.camada ? null : a.camada)} />)}
        </div>
      </div>

      <Painel titulo="Fontes do diagnóstico" aside={`${ligados} de ${catalogo.length} temas ligados em tempo real`} corpo="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr className="border-b border-borda bg-realce text-left text-[12.5px] text-texto-2">
                <th scope="col" className="px-3.5 py-2 font-semibold">Tema</th>
                <th scope="col" className="px-3.5 py-2 font-semibold">Fonte</th>
                <th scope="col" className="px-3.5 py-2 font-semibold">Base legal</th>
                <th scope="col" className="px-3.5 py-2 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {catalogo.map((c) => {
                const n = normaCitada(c.base);
                return (
                  <tr key={c.codigo ?? c.nome} className="align-top">
                    <td className="px-3.5 py-2 font-semibold">{c.nome}</td>
                    <td className="px-3.5 py-2 text-texto-2">{c.fonte}{c.licenca ? <span className="block text-[12.5px] text-texto-3">Licença: {c.licenca}</span> : null}</td>
                    <td className="px-3.5 py-2 text-texto-2">{n ? <a href={n.url} target="_blank" rel="noreferrer" className="text-azul hover:underline">{c.base}</a> : c.base}</td>
                    <td className="px-3.5 py-2">
                      <Etiqueta tom={c.situacao === "ao_vivo" ? "verde" : "neutro"}>{c.situacao === "ao_vivo" ? "Consulta em tempo real" : "Ainda não ligada"}</Etiqueta>
                      {c.situacao !== "ao_vivo" && c.observacao && <span className="mt-1 block max-w-md text-[12.5px] leading-snug text-texto-3">{c.observacao}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Painel>
    </div>
  );
}

function Tema({ a, isolado, aoIsolar }: { a: Achado; isolado: boolean; aoIsolar: () => void }) {
  const norma = normaCitada(a.base);
  const metricas = Object.entries(a.metricas ?? {}).filter(([k]) => k !== "erro" || a.severidade === "sem_dado");
  const feicoes = (a.evidencias ?? []).map((f) => f.properties as { rotulo: string; dist_m: number; toca: boolean });
  return (
    <article className="painel p-3.5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[14.5px] leading-tight font-semibold">{a.camada}</h3>
        <Etiqueta tom={SEVERIDADE[a.severidade].tom}>{SEVERIDADE[a.severidade].rotulo}</Etiqueta>
      </div>
      <p className="mt-1.5 text-[14px] leading-snug text-texto">{a.resultado}</p>
      {a.implicacao && <p className="mt-1 text-[13.5px] leading-snug text-texto-2">{a.implicacao}</p>}
      {a.base && (
        <p className="mt-1 text-[13px]">
          {norma
            ? <a href={norma.url} target="_blank" rel="noreferrer" className="inline-flex items-baseline gap-0.5 text-azul hover:underline">{a.base}<ExternalLink className="size-3 translate-y-px" aria-label="(abre em nova aba)" /></a>
            : <span className="text-texto-2">{a.base}</span>}
        </p>
      )}
      <p className="mt-1 text-[12.5px] leading-snug text-texto-3">
        Fonte: {a.fonte}.{a.tempo_ms != null ? ` Respondeu em ${(a.tempo_ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s.` : ""}
      </p>
      {(metricas.length > 0 || feicoes.length > 0) && (
        <details className="mt-2 border-t border-borda pt-2 text-[13px]">
          <summary className="cursor-pointer font-semibold text-texto-2">Números e feições ({feicoes.length})</summary>
          {metricas.length > 0 && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {metricas.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-texto-3">{ROTULO_METRICA[k] ?? k}</dt>
                  <dd className="num min-w-0 break-words text-texto">{fmtValor(v)}</dd>
                </div>
              ))}
            </dl>
          )}
          {feicoes.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {feicoes.slice(0, 12).map((f, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{f.rotulo}</span>
                  <span className="num shrink-0 text-texto-3">{f.toca ? "sobre o perímetro" : `${f.dist_m.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m`}</span>
                </li>
              ))}
              {feicoes.length > 12 && <li className="text-texto-3">e mais {feicoes.length - 12}</li>}
            </ul>
          )}
        </details>
      )}
      {feicoes.length > 0 && (
        <button type="button" aria-pressed={isolado} onClick={aoIsolar} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-azul hover:underline">
          <MapPinned className="size-3.5" aria-hidden /> {isolado ? "Mostrar as feições de todos os temas" : `Ver só estas ${feicoes.length} feições no mapa`}
        </button>
      )}
    </article>
  );
}
