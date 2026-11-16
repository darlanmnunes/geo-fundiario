"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, ExternalLink, MapPinned, RefreshCw } from "lucide-react";
import { Mapa } from "./mapa";
import { Etiqueta, classeBotao } from "./ui";
import type { CamadasMapa } from "@/lib/dados";
import { MODALIDADE, normaCitada } from "@/lib/dominio";
import { api, TEM_API } from "@/lib/sessao";
import { ORDEM_SEVERIDADE, SEVERIDADE, type Dossie, type Severidade } from "@/lib/inteligencia";

export interface NucleoDossie { id: number; nome: string; modalidade: string; area_ha: number; unidades: number; dossie: Dossie | null }

export function DossieTerritorial({ nucleos, camadas }: { nucleos: NucleoDossie[]; camadas: CamadasMapa }) {
  const [id, setId] = useState(nucleos[0]?.id ?? 0);
  const [so, setSo] = useState<Severidade | null>(null);
  // Achados consultados agora nas fontes ligadas (substituem os gravados, por tema, enquanto a página está aberta)
  const [aoVivo, setAoVivo] = useState<Record<number, { em: string; achados: Dossie["achados"]; previstos: { camada: string; fonte: string }[] }>>({});
  const [noMapa, setNoMapa] = useState<string | null>(null);
  const [consulta, setConsulta] = useState<"parado" | "consultando" | string>("parado");
  // Com a API ligada, relê o dossiê gravado: ele pode ter sido atualizado pelo Diagnóstico territorial.
  const [gravadosAgora, setGravadosAgora] = useState<Record<number, Dossie>>({});
  useEffect(() => {
    if (!TEM_API) return;
    let vivo = true;
    api<Dossie>(`/projetos/${id}/dossie`).then((x) => vivo && setGravadosAgora((g) => ({ ...g, [id]: x })), () => undefined);
    return () => { vivo = false; };
  }, [id]);
  const n = nucleos.find((x) => x.id === id) ?? nucleos[0];
  const d = gravadosAgora[id] ?? n?.dossie;
  const vivos = aoVivo[id]?.achados ?? [];
  const consultar = async () => {
    setConsulta("consultando");
    try {
      const resp = await api<{ consultado_em: string; achados: Dossie["achados"]; previstos?: { camada: string; fonte: string }[] }>(`/projetos/${id}/diagnostico`);
      setAoVivo((a) => ({ ...a, [id]: { em: resp.consultado_em, achados: resp.achados, previstos: resp.previstos ?? [] } }));
      setConsulta("parado");
    } catch (e) {
      setConsulta(e instanceof Error ? e.message : "A consulta falhou.");
    }
  };
  // Os temas consultados agora substituem os gravados de mesmo nome; os que o dossiê gravado não tinha entram no fim.
  const gravados = d?.achados ?? [];
  const mesmo = (a: Dossie["achados"][number], b: Dossie["achados"][number]) => (a.codigo && b.codigo ? a.codigo === b.codigo : a.camada === b.camada);
  const respondidos = vivos.filter((v) => v.severidade !== "sem_dado" || !gravados.some((g) => mesmo(g, v)));
  const achados = d ? [...gravados.map((a) => respondidos.find((v) => mesmo(v, a)) ?? a), ...respondidos.filter((v) => !gravados.some((g) => mesmo(g, v)))].sort((a, b) => ORDEM_SEVERIDADE.indexOf(a.severidade) - ORDEM_SEVERIDADE.indexOf(b.severidade)) : [];
  const contagem = (s: Severidade) => achados.filter((a) => a.severidade === s).length;
  const visiveis = achados.filter((a) => !so || a.severidade === so);
  const evidencias: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: vivos.filter((v) => !noMapa || v.camada === noMapa).flatMap((v) => v.evidencias ?? []) };
  const semResposta = vivos.filter((v) => v.severidade === "sem_dado").map((v) => v.camada);
  const trocar = (novo: number) => {
    setNoMapa(null);
    setConsulta("parado");
    setId(novo);
    setSo(null);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div role="tablist" aria-label="Núcleo analisado" className="mb-2 flex flex-wrap overflow-hidden rounded border border-borda-forte bg-superficie">
          {nucleos.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === id} onClick={() => trocar(x.id)}
              className={clsx("h-9 flex-1 border-r border-borda px-3 text-[13.5px] whitespace-nowrap last:border-r-0", x.id === id ? "bg-azul font-semibold text-white" : "text-texto hover:bg-realce")}>
              {x.nome.replace("Núcleo ", "")}
            </button>
          ))}
        </div>
        <Mapa camadas={camadas} foco={id} aoSelecionar={(uid) => uid && trocar(Number(uid.split(":")[0]))} ocultas={["logradouros"]} rotuloNucleo evidencias={evidencias} className="h-[420px] xl:h-[calc(100vh-15rem)] xl:min-h-[520px]" />
        <p className="mt-1.5 text-[12.5px] text-texto-3">
          Em azul claro, a faixa de 30 m a partir dos corpos d&apos;água (base OpenStreetMap). {evidencias.features.length > 0 && "Em laranja, as feições devolvidas pelas fontes consultadas agora. "}Os botões à direita do mapa ligam ou desligam cada tema, trocam o mapa base e abrem a legenda.
        </p>
      </div>

      <section className="painel self-start" aria-live="polite" aria-label={`Dossiê do ${n.nome}`}>
        <header className="!items-start">
          <div className="min-w-0 py-1">
            <h2 className="text-[16px] leading-tight font-semibold">{n.nome}</h2>
            <p className="mt-0.5 text-[13px] text-texto-3">{MODALIDADE[n.modalidade]}, {n.unidades} unidades, {n.area_ha.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha</p>
          </div>
          <Link href={`/projetos/${n.id}`} className={classeBotao("secundario", "mt-1 h-7 shrink-0 px-2.5")}>Abrir núcleo <ArrowRight className="size-3.5" aria-hidden /></Link>
        </header>
        {d ? (
          <>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 border-b border-borda p-3.5">
              <div className="text-center">
                <div className={clsx("num text-[30px] leading-none font-bold", d.pontuacao >= 70 ? "text-verde" : d.pontuacao >= 45 ? "text-ambar" : "text-vermelho")}>{d.pontuacao}</div>
                <div className="text-[12px] text-texto-3">de 100</div>
              </div>
              <div>
                <p className="text-[13px] font-semibold">Aptidão para prosseguir sem intervenção extra</p>
                <div className="mt-1 h-2 overflow-hidden rounded-[2px] bg-borda" role="img" aria-label={`Aptidão ${d.pontuacao} de 100`}>
                  <div className={clsx("h-full", d.pontuacao >= 70 ? "bg-verde" : d.pontuacao >= 45 ? "bg-[#d99100]" : "bg-vermelho")} style={{ width: `${d.pontuacao}%` }} />
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-texto-2">{d.resumo}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-borda bg-realce px-3.5 py-2 text-[13px]">
              <button type="button" onClick={consultar} disabled={!TEM_API || consulta === "consultando"} className={classeBotao("secundario", "h-7 px-2.5")}>
                <RefreshCw className={clsx("size-3.5", consulta === "consultando" && "animate-spin")} aria-hidden /> Consultar as fontes agora
              </button>
              <span className="text-texto-3" role="status">
                {!TEM_API ? "Disponível na instalação com a API: os conectores ligados consultam cada fonte em tempo real."
                  : consulta === "consultando" ? "Consultando os conectores ligados."
                  : consulta !== "parado" ? consulta
                  : aoVivo[id] ? `Consultado às ${new Date(aoVivo[id].em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}: ${vivos.length - semResposta.length} de ${vivos.length} fontes responderam.${semResposta.length ? ` Sem resposta agora: ${semResposta.join(", ")}.` : ""}` : "Mostrando o último dossiê gravado. A consulta leva até meio minuto; o detalhe de cada fonte fica em Diagnóstico territorial."}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-b border-borda px-3.5 py-2">
              <span className="mr-1 text-[12.5px] text-texto-3">Filtrar</span>
              {ORDEM_SEVERIDADE.filter((s) => contagem(s)).map((s) => (
                <button key={s} type="button" onClick={() => setSo(so === s ? null : s)} aria-pressed={so === s} title={SEVERIDADE[s].explicacao}
                  className={clsx("rounded-[3px]", so && so !== s && "opacity-40", so === s && "ring-2 ring-azul ring-offset-1")}>
                  <Etiqueta tom={SEVERIDADE[s].tom}>{SEVERIDADE[s].rotulo} <span className="num">{contagem(s)}</span></Etiqueta>
                </button>
              ))}
            </div>
            <ul className="divide-y divide-borda xl:max-h-[calc(100vh-27rem)] xl:min-h-[240px] xl:overflow-y-auto">
              {visiveis.map((a) => {
                const norma = normaCitada(a.base);
                const agora = vivos.some((v) => v.camada === a.camada);
                return (
                  <li key={a.camada} className="px-3.5 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-[13.5px] leading-tight font-semibold">{a.camada}</h3>
                      <Etiqueta tom={SEVERIDADE[a.severidade].tom}>{SEVERIDADE[a.severidade].rotulo}</Etiqueta>
                    </div>
                    <p className="mt-1 text-[13.5px] leading-snug text-texto">
                      {a.resultado}{a.implicacao ? ` ${a.implicacao}` : ""}{" "}
                      {a.base && (norma
                        ? <a href={norma.url} target="_blank" rel="noreferrer" className="inline-flex items-baseline gap-0.5 whitespace-nowrap text-azul hover:underline">{a.base}<ExternalLink className="size-3 translate-y-px" aria-label="(abre em nova aba)" /></a>
                        : <span className="text-texto-2">{a.base}.</span>)}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-snug text-texto-3">
                      Fonte: {a.fonte}. {agora ? "Consultado agora na fonte." : a.consultado_em ? `Consultado na fonte em ${new Date(a.consultado_em).toLocaleDateString("pt-BR")}.` : a.origem === "calculado" ? "Calculado sobre a geometria do núcleo." : "Valor simulado nesta demonstração."}
                    </p>
                    {agora && (a.evidencias?.length ?? 0) > 0 && (
                      <button type="button" aria-pressed={noMapa === a.camada} onClick={() => setNoMapa(noMapa === a.camada ? null : a.camada)} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-azul hover:underline">
                        <MapPinned className="size-3.5" aria-hidden /> {noMapa === a.camada ? "Mostrar as evidências de todos os temas" : `Ver só estas ${a.evidencias?.length} feições no mapa`}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {aoVivo[id] && aoVivo[id].previstos.length > 0 && (
              <p className="border-t border-borda px-3.5 py-2.5 text-[12.5px] leading-snug text-texto-3">
                Ainda sem conector: {aoVivo[id].previstos.map((p) => p.camada).join(", ")}. Esses temas dependem de dado do município, de convênio ou de credencial.
              </p>
            )}
          </>
        ) : (
          <p className="p-4 text-[13.5px] text-texto-2">Este núcleo ainda não tem dossiê. Ele é gerado quando o perímetro preliminar é cadastrado.</p>
        )}
      </section>
    </div>
  );
}
