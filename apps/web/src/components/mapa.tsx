"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapMouseEvent, StyleSpecification } from "maplibre-gl";
import clsx from "clsx";
import { Database, ListTree, Map as IconeMapa, Search, X } from "lucide-react";
import { SITUACAO_LOTE } from "@/lib/dominio";
import type { CamadasMapa, LoteMapa } from "@/lib/dados";

// Camadas de base. Dados vetoriais do OpenStreetMap servidos pelo OpenFreeMap; imagens da Esri.
const OFM = "https://tiles.openfreemap.org";
const GLIFOS = `${OFM}/fonts/{fontstack}/{range}.pbf`;
const IMAGEM = {
  type: "raster" as const,
  tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
  tileSize: 256,
  maxzoom: 19,
  attribution: "Imagens © Esri, Maxar, Earthstar Geographics",
};
export const BASES = {
  mapa: { rotulo: "Mapa (OpenStreetMap)", nota: "Ruas, edificações e toponímia", escura: false },
  cinza: { rotulo: "Cinza claro", nota: "Fundo neutro para destacar os dados", escura: false },
  imagem: { rotulo: "Imagem de satélite", nota: "Ortoimagem, sem rótulos", escura: true },
  hibrido: { rotulo: "Híbrido", nota: "Imagem com ruas e nomes", escura: true },
} as const;
export type Base = keyof typeof BASES;

const FONTE = ["Noto Sans Regular"];
const FONTE_NEGRITO = ["Noto Sans Bold"];

function estilo(base: Base): string | StyleSpecification {
  if (base === "mapa") return `${OFM}/styles/liberty`;
  if (base === "cinza") return `${OFM}/styles/positron`;
  const imagem: StyleSpecification = {
    version: 8,
    glyphs: GLIFOS,
    sources: { imagem: IMAGEM },
    layers: [{ id: "imagem", type: "raster", source: "imagem" }],
  };
  if (base === "imagem") return imagem;
  // Híbrido: sobre a imagem, o viário e a toponímia do OpenStreetMap (esquema OpenMapTiles).
  return {
    ...imagem,
    sources: { ...imagem.sources, osm: { type: "vector", url: `${OFM}/planet` } },
    layers: [
      ...imagem.layers,
      { id: "h-via-borda", type: "line", source: "osm", "source-layer": "transportation", filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service"]]],
        paint: { "line-color": "#1b2430", "line-opacity": 0.35, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.5, 18, 9] } },
      { id: "h-via", type: "line", source: "osm", "source-layer": "transportation", filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service"]]],
        paint: { "line-color": "#ffffff", "line-opacity": 0.55, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.6, 18, 5] } },
      { id: "h-via-nome", type: "symbol", source: "osm", "source-layer": "transportation_name", minzoom: 14,
        layout: { "symbol-placement": "line", "text-field": ["coalesce", ["get", "name:pt"], ["get", "name"]], "text-font": FONTE, "text-size": 11.5 },
        paint: { "text-color": "#ffffff", "text-halo-color": "#1b2430", "text-halo-width": 1.4 } },
      { id: "h-lugar", type: "symbol", source: "osm", "source-layer": "place",
        layout: { "text-field": ["coalesce", ["get", "name:pt"], ["get", "name"]], "text-font": FONTE_NEGRITO, "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 16, 15] },
        paint: { "text-color": "#ffffff", "text-halo-color": "#1b2430", "text-halo-width": 1.6 } },
    ],
  };
}

const corSituacao = [
  "match", ["get", "situacao"],
  ...Object.entries(SITUACAO_LOTE).flatMap(([k, v]) => [k, v.cor]),
  "#8c97a6",
] as unknown as maplibregl.ExpressionSpecification;

type GJ = GeoJSON.FeatureCollection | GeoJSON.Feature;
function limites(gj: GJ): maplibregl.LngLatBounds {
  const b = new maplibregl.LngLatBounds();
  const visitar = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") b.extend(c as [number, number]);
    else if (Array.isArray(c)) c.forEach(visitar);
  };
  const feats = gj.type === "FeatureCollection" ? gj.features : [gj];
  feats.forEach((f) => f.geometry && "coordinates" in f.geometry && visitar(f.geometry.coordinates));
  return b;
}

const SOBREPOSICOES = [
  { id: "lotes", rotulo: "Unidades (lotes)", camadas: ["lotes-preench", "lotes-borda", "rotulo-lote"] },
  { id: "quadras", rotulo: "Quadras", camadas: ["quadras"] },
  { id: "perimetros", rotulo: "Perímetro do núcleo", camadas: ["perimetros", "rotulo-nucleo"] },
  { id: "logradouros", rotulo: "Eixos de logradouro", camadas: ["logradouros", "rotulo-rua"] },
  { id: "app", rotulo: "Hidrografia e faixa de 30 m", camadas: ["faixa-app", "faixa-app-borda", "hidro-area", "hidro-linha"] },
] as const;
type Sobreposicao = (typeof SOBREPOSICOES)[number]["id"];

interface Props {
  camadas: CamadasMapa;
  /** uid da unidade a destacar (ficha do lote): as demais ficam esmaecidas e o mapa não seleciona. */
  destaque?: string;
  selecionado?: string | null;
  aoSelecionar?: (uid: string | null) => void;
  /** Situações visíveis; ausente = todas. */
  situacoes?: string[];
  /** Núcleo a enquadrar; ausente = todos os núcleos das camadas. */
  foco?: number | null;
  baseInicial?: Base;
  /** Sobreposições desligadas ao abrir. */
  ocultas?: Sobreposicao[];
  rotuloNucleo?: boolean;
  className?: string;
}

export function Mapa({ camadas, destaque, selecionado, aoSelecionar, situacoes, foco = null, baseInicial = "hibrido", ocultas = ["logradouros", "app"], rotuloNucleo = false, className }: Props) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const callback = useRef(aoSelecionar);
  const hover = useRef<string | null>(null);
  const [base, setBase] = useState<Base>(baseInicial);
  const [visiveis, setVisiveis] = useState<Set<Sobreposicao>>(() => new Set(SOBREPOSICOES.map((s) => s.id).filter((s) => !ocultas.includes(s))));
  const [painel, setPainel] = useState<"dados" | "base" | "legenda" | null>(null);
  const [busca, setBusca] = useState("");
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null);
  // Estado lido de dentro dos manipuladores do mapa, que vivem mais que um render.
  const estado = useRef({ base, visiveis, selecionado, situacoes, camadas });
  useEffect(() => {
    estado.current = { base, visiveis, selecionado, situacoes, camadas };
    callback.current = aoSelecionar;
  });

  const alvoAtual = useRef<() => GJ>(() => camadas.perimetros);

  const temApp = camadas.faixaApp.features.length > 0 || camadas.hidrografia.features.length > 0;

  useEffect(() => {
    if (!div.current) return;
    maplibregl.setWorkerUrl(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/maplibre/maplibre-gl-worker.mjs`);
    const alvoInicial = (): GJ => {
      const c = estado.current.camadas;
      if (destaque) return { type: "FeatureCollection", features: c.lotes.features.filter((f) => f.properties.uid === destaque) };
      if (foco != null) return { type: "FeatureCollection", features: c.perimetros.features.filter((f) => f.properties?.projeto === foco) };
      return c.perimetros;
    };
    const enquadramento = { padding: destaque ? 80 : 40, maxZoom: 19.5 };
    alvoAtual.current = alvoInicial;
    const m = new maplibregl.Map({
      container: div.current,
      style: estilo(estado.current.base),
      bounds: limites(alvoInicial()),
      fitBoundsOptions: enquadramento,
      attributionControl: false,
      maxZoom: 21,
      cooperativeGestures: false,
    });
    // Atribuição sempre visível (sem o botão "i"), como nos portais de mapas.
    m.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-right");
    m.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), "top-left");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-left");
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, maxWidth: "260px" });

    // Recoloca as camadas do sistema toda vez que o estilo de base carrega (a troca de base as remove).
    const montar = () => {
      if (m.getSource("lotes")) return;
      const { base: b, camadas: c, visiveis: v } = estado.current;
      const escura = BASES[b].escura;
      const traco = escura ? "#ffffff" : "#1b2430";
      const halo = escura ? "#1b2430" : "#ffffff";
      m.addSource("perimetros", { type: "geojson", data: c.perimetros });
      m.addSource("quadras", { type: "geojson", data: c.quadras });
      m.addSource("logradouros", { type: "geojson", data: c.logradouros });
      m.addSource("hidrografia", { type: "geojson", data: c.hidrografia });
      m.addSource("faixa-app", { type: "geojson", data: c.faixaApp });
      m.addSource("lotes", { type: "geojson", data: c.lotes, promoteId: "uid" });

      m.addLayer({ id: "faixa-app", type: "fill", source: "faixa-app", paint: { "fill-color": "#2aa3c7", "fill-opacity": 0.2 } });
      m.addLayer({ id: "faixa-app-borda", type: "line", source: "faixa-app", paint: { "line-color": escura ? "#8fe0f5" : "#147a99", "line-width": 1.2, "line-dasharray": [2, 2] } });
      m.addLayer({ id: "hidro-area", type: "fill", source: "hidrografia", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#2aa3c7", "fill-opacity": 0.35 } });
      m.addLayer({ id: "hidro-linha", type: "line", source: "hidrografia", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": escura ? "#8fe0f5" : "#147a99", "line-width": 1.6 } });
      m.addLayer({ id: "perimetros", type: "line", source: "perimetros", paint: { "line-color": escura ? "#ffe066" : "#b8251a", "line-width": 2.2, "line-dasharray": [3, 2] } });
      m.addLayer({ id: "quadras", type: "line", source: "quadras", paint: { "line-color": traco, "line-width": 1.2, "line-opacity": 0.75 } });
      m.addLayer({ id: "logradouros", type: "line", source: "logradouros", paint: { "line-color": traco, "line-width": 1, "line-opacity": 0.5, "line-dasharray": [6, 3] } });
      m.addLayer({ id: "lotes-preench", type: "fill", source: "lotes", paint: {
        "fill-color": corSituacao,
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "sel"], false], 0.9,
          ["boolean", ["feature-state", "hover"], false], 0.85,
          destaque ? ["case", ["==", ["get", "uid"], destaque], 0.85, 0.2] : 0.68,
        ],
      } });
      m.addLayer({ id: "lotes-borda", type: "line", source: "lotes", paint: {
        "line-color": ["case", ["boolean", ["feature-state", "sel"], false], escura ? "#ffffff" : "#0b2f66", traco],
        "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 3, ["boolean", ["feature-state", "hover"], false], 2, 0.8],
      } });
      m.addLayer({ id: "rotulo-lote", type: "symbol", source: "lotes", minzoom: 17.2, layout: {
        "text-field": ["slice", ["get", "codigo"], 4], "text-size": 11, "text-font": FONTE_NEGRITO,
      }, paint: { "text-color": "#1b2430", "text-halo-color": "#ffffff", "text-halo-width": 1.4 } });
      m.addLayer({ id: "rotulo-rua", type: "symbol", source: "logradouros", layout: {
        "symbol-placement": "line", "text-field": ["get", "nome"], "text-size": 11.5, "text-font": FONTE,
      }, paint: { "text-color": traco, "text-halo-color": halo, "text-halo-width": 1.4 } });
      m.addLayer({ id: "rotulo-nucleo", type: "symbol", source: "perimetros", maxzoom: 17.2, layout: {
        "text-field": rotuloNucleo ? ["get", "nome"] : "", "text-size": 13, "text-font": FONTE_NEGRITO, "text-anchor": "bottom", "text-offset": [0, -0.4], "text-allow-overlap": true,
      }, paint: { "text-color": traco, "text-halo-color": halo, "text-halo-width": 1.8 } });

      for (const s of SOBREPOSICOES) for (const id of s.camadas) m.setLayoutProperty(id, "visibility", v.has(s.id) ? "visible" : "none");
      aplicarFiltro();
      aplicarSelecao();
    };
    const aplicarFiltro = () => {
      const s = estado.current.situacoes;
      const filtro = s ? (["in", ["get", "situacao"], ["literal", s]] as maplibregl.FilterSpecification) : null;
      for (const id of ["lotes-preench", "lotes-borda", "rotulo-lote"]) if (m.getLayer(id)) m.setFilter(id, filtro);
    };
    const aplicarSelecao = () => {
      if (!m.getSource("lotes")) return;
      m.removeFeatureState({ source: "lotes" });
      const s = estado.current.selecionado;
      if (s) m.setFeatureState({ source: "lotes", id: s }, { sel: true });
    };
    m.on("style.load", montar);
    m.on("error", (e) => console.error("[mapa]", e.error?.message ?? e));
    m.once("load", () => {
      // O contêiner pode ter mudado de tamanho enquanto o layout assentava: reenquadra uma vez.
      m.resize();
      m.fitBounds(limites(alvoInicial()), { ...enquadramento, duration: 0 });
    });
    // Até a pessoa mexer no mapa, toda mudança de tamanho do contêiner reenquadra o alvo inteiro.
    let mexeu = false;
    const marcar = (e: { originalEvent?: unknown }) => { if (e.originalEvent) mexeu = true; };
    m.on("dragstart", marcar);
    m.on("zoomstart", marcar);
    const observador = new ResizeObserver(() => {
      m.resize();
      if (mexeu) return;
      const b = limites(alvoAtual.current());
      if (!b.isEmpty()) m.fitBounds(b, { ...enquadramento, duration: 0 });
    });
    observador.observe(div.current);

    if (!destaque) {
      m.on("click", "lotes-preench", (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const uid = e.features?.[0]?.properties?.uid;
        if (uid) callback.current?.(String(uid));
      });
      m.on("mousemove", "lotes-preench", (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        const uid = f ? String(f.properties.uid) : null;
        if (hover.current && hover.current !== uid) m.setFeatureState({ source: "lotes", id: hover.current }, { hover: false });
        if (uid && f) {
          m.setFeatureState({ source: "lotes", id: uid }, { hover: true });
          const p = f.properties as LoteMapa;
          const linha = document.createElement("div");
          const titulo = document.createElement("strong");
          titulo.textContent = `${p.codigo}${rotuloNucleo ? ` - ${p.nucleo.replace("Núcleo ", "")}` : ""}`;
          const quem = document.createElement("div");
          quem.textContent = p.ocupante ?? "Sem ocupante identificado";
          const resto = document.createElement("div");
          resto.style.color = "#667284";
          resto.textContent = `${SITUACAO_LOTE[p.situacao as keyof typeof SITUACAO_LOTE]?.rotulo ?? p.situacao} - ${Number(p.area_m2).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m²${p.pendencias ? ` - ${p.pendencias} pendência(s)` : ""}`;
          linha.append(titulo, quem, resto);
          popup.setLngLat(e.lngLat).setDOMContent(linha).addTo(m);
        }
        hover.current = uid;
        m.getCanvas().style.cursor = "pointer";
      });
      m.on("mouseleave", "lotes-preench", () => {
        if (hover.current) m.setFeatureState({ source: "lotes", id: hover.current }, { hover: false });
        hover.current = null;
        popup.remove();
        m.getCanvas().style.cursor = "";
      });
    }
    m.on("mousemove", (e) => setCursor({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
    m.on("mouseout", () => setCursor(null));
    mapa.current = m;
    return () => {
      observador.disconnect();
      popup.remove();
      m.remove();
      mapa.current = null;
    };
    // O mapa é criado uma vez; base, filtros, seleção e foco são aplicados pelos efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Troca de base sem recriar o mapa: a vista é preservada.
  const baseAplicada = useRef(base);
  useEffect(() => {
    const m = mapa.current;
    if (!m || baseAplicada.current === base) return;
    baseAplicada.current = base;
    m.setStyle(estilo(base), { diff: false });
  }, [base]);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const aplicar = () => {
      for (const s of SOBREPOSICOES) for (const id of s.camadas) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", visiveis.has(s.id) ? "visible" : "none");
    };
    if (m.isStyleLoaded()) aplicar();
    else m.once("idle", aplicar);
  }, [visiveis]);

  const chaveSituacoes = situacoes?.join(",") ?? "";
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const aplicar = () => {
      const filtro = situacoes ? (["in", ["get", "situacao"], ["literal", situacoes]] as maplibregl.FilterSpecification) : null;
      for (const id of ["lotes-preench", "lotes-borda", "rotulo-lote"]) if (m.getLayer(id)) m.setFilter(id, filtro);
    };
    if (m.isStyleLoaded()) aplicar();
    else m.once("idle", aplicar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveSituacoes]);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const aplicar = () => {
      if (!m.getSource("lotes")) return;
      m.removeFeatureState({ source: "lotes" });
      if (selecionado) m.setFeatureState({ source: "lotes", id: selecionado }, { sel: true });
    };
    if (m.isStyleLoaded()) aplicar();
    else m.once("idle", aplicar);
  }, [selecionado]);

  const focoAplicado = useRef(foco);
  useEffect(() => {
    const m = mapa.current;
    if (!m || focoAplicado.current === foco) return;
    focoAplicado.current = foco;
    const alvo: GJ = foco == null ? camadas.perimetros : { type: "FeatureCollection", features: camadas.perimetros.features.filter((f) => f.properties?.projeto === foco) };
    alvoAtual.current = () => alvo;
    const b = limites(alvo);
    if (!b.isEmpty()) m.fitBounds(b, { padding: 40, maxZoom: 19, duration: 500 });
  }, [foco, camadas]);

  useEffect(() => {
    (mapa.current?.getSource("lotes") as GeoJSONSource | undefined)?.setData(camadas.lotes);
  }, [camadas.lotes]);

  const termo = busca.trim().toLowerCase();
  const achados = termo.length >= 2
    ? camadas.lotes.features.filter((f) => f.properties.codigo.toLowerCase().includes(termo) || f.properties.ocupante?.toLowerCase().includes(termo)).slice(0, 8)
    : [];
  const irPara = (f: (typeof camadas.lotes.features)[number]) => {
    const b = limites(f);
    if (!b.isEmpty()) mapa.current?.fitBounds(b, { padding: 120, maxZoom: 19.5, duration: 500 });
    setBusca("");
    if (!destaque) callback.current?.(f.properties.uid);
  };

  const alternar = (s: Sobreposicao) =>
    setVisiveis((v) => {
      const n = new Set(v);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });

  return (
    <div className={clsx("relative overflow-hidden rounded border border-borda bg-borda/40", className)}>
      <div ref={div} className="h-full w-full" />

      {/* Pesquisa, ao lado dos controles de navegação (à esquerda) */}
      <div className="absolute top-2.5 left-[52px] z-10 w-[min(15rem,calc(100%-7.5rem))]">
        <label className="relative block">
          <span className="sr-only">Pesquisar unidade ou ocupante no mapa</span>
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-texto-3" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar unidade ou ocupante"
            className="h-[29px] w-full rounded border border-borda-forte bg-superficie pr-2 pl-7 text-[13px] shadow-[0_1px_3px_rgb(27_36_48/0.3)] placeholder:text-texto-3" />
        </label>
        {achados.length > 0 && (
          <ul className="mt-1 max-h-56 overflow-y-auto rounded border border-borda-forte bg-superficie py-0.5 text-[13px] shadow-[0_4px_14px_rgb(27_36_48/0.22)]">
            {achados.map((f) => (
              <li key={f.properties.uid}>
                <button type="button" onClick={() => irPara(f)} className="block w-full px-2.5 py-1 text-left hover:bg-azul-claro">
                  <span className="cod font-medium">{f.properties.codigo}</span> <span className="text-texto-3">{f.properties.nucleo.replace("Núcleo ", "")}</span>
                  <span className="block truncate text-[12px] text-texto-2">{f.properties.ocupante ?? "Sem ocupante identificado"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {busca.trim().length >= 2 && !achados.length && <p className="mt-1 rounded border border-borda-forte bg-superficie px-2.5 py-1.5 text-[12.5px] text-texto-2">Nada encontrado neste mapa.</p>}
      </div>

      {/* Camadas, à direita: um botão por assunto, empilhados */}
      <div className="absolute top-2.5 right-2.5 z-10 flex flex-col items-end gap-1.5">
        {([["dados", Database, "Camadas de dados"], ["base", IconeMapa, "Mapa base"], ["legenda", ListTree, "Legenda"]] as const).map(([id, Icone, rotulo]) => (
          <div key={id} className="relative">
            <button type="button" onClick={() => setPainel(painel === id ? null : id)} aria-expanded={painel === id} aria-label={rotulo} title={rotulo}
              className={clsx("flex size-[33px] items-center justify-center rounded border shadow-[0_1px_3px_rgb(27_36_48/0.3)]", painel === id ? "border-azul bg-azul text-white" : "border-borda-forte bg-superficie text-texto hover:bg-realce")}>
              <Icone className="size-[18px]" aria-hidden />
            </button>
            {painel === id && (
              <div className="absolute top-0 right-[39px] w-60 rounded border border-borda-forte bg-superficie text-[13px] shadow-[0_4px_14px_rgb(27_36_48/0.22)]">
                <div className="flex items-center justify-between border-b border-borda px-3 py-1.5">
                  <span className="font-semibold">{rotulo}</span>
                  <button type="button" onClick={() => setPainel(null)} aria-label="Fechar" className="rounded p-0.5 text-texto-3 hover:bg-realce hover:text-texto"><X className="size-4" /></button>
                </div>
                {id === "dados" && (
                  <div className="px-1.5 py-1.5">
                    {SOBREPOSICOES.filter((x) => x.id !== "app" || temApp).map((x) => (
                      <label key={x.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-realce">
                        <input type="checkbox" checked={visiveis.has(x.id)} onChange={() => alternar(x.id)} />
                        <span className="text-texto">{x.rotulo}</span>
                      </label>
                    ))}
                  </div>
                )}
                {id === "base" && (
                  <div className="px-1.5 py-1.5">
                    {(Object.keys(BASES) as Base[]).map((b) => (
                      <label key={b} className={clsx("flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 hover:bg-realce", base === b && "bg-azul-claro hover:bg-azul-claro")}>
                        <input type="radio" name="base" checked={base === b} onChange={() => setBase(b)} className="mt-[3px]" />
                        <span>
                          <span className="block leading-tight font-medium text-texto">{BASES[b].rotulo}</span>
                          <span className="block text-[12px] leading-tight text-texto-3">{BASES[b].nota}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {id === "legenda" && (
                  <ul className="space-y-1 px-3 py-2 text-texto-2">
                    {Object.values(SITUACAO_LOTE).map((v) => <li key={v.rotulo} className="flex items-center gap-2"><span aria-hidden className="inline-block size-3 rounded-[2px]" style={{ background: v.cor }} />{v.rotulo}</li>)}
                    <li className="flex items-center gap-2 border-t border-borda pt-1.5"><span aria-hidden className="inline-block h-0 w-4 border-t-2 border-dashed border-vermelho" />Perímetro do núcleo</li>
                    <li className="flex items-center gap-2"><span aria-hidden className="inline-block h-0 w-4 border-t-2 border-texto" />Quadra</li>
                    {temApp && <li className="flex items-center gap-2"><span aria-hidden className="inline-block size-3 rounded-[2px] bg-[#2aa3c7]/40 ring-1 ring-[#147a99]" />Corpo d&apos;água e faixa de 30 m</li>}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {cursor && (
        <div className="cod pointer-events-none absolute bottom-7 left-2.5 rounded-sm bg-white/80 px-1.5 py-px text-[11px] text-texto">
          {cursor.lat.toFixed(6)}, {cursor.lng.toFixed(6)} (SIRGAS 2000)
        </div>
      )}
    </div>
  );
}

/** Legenda das situações, com contagem opcional. */
export function LegendaSituacoes({ contagem, className }: { contagem?: Record<string, number>; className?: string }) {
  return (
    <ul className={clsx("flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-texto-2", className)}>
      {Object.entries(SITUACAO_LOTE).map(([k, v]) => (
        <li key={k} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-[2px]" style={{ background: v.cor }} />
          {v.rotulo}
          {contagem && <span className="num text-texto">{contagem[k] ?? 0}</span>}
        </li>
      ))}
    </ul>
  );
}
