"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapMouseEvent, StyleSpecification } from "maplibre-gl";
import clsx from "clsx";
import { SITUACAO_LOTE } from "@/lib/dominio";

export interface LoteMapa {
  codigo: string;
  situacao: string;
  area_m2: number;
  ocupante: string | null;
  pendencias: number;
}

type GJ = GeoJSON.FeatureCollection | GeoJSON.Feature;

interface Props {
  perimetro: GJ;
  quadras: GJ;
  logradouros: GJ;
  lotes: GeoJSON.FeatureCollection<GeoJSON.Geometry, LoteMapa>;
  destaque?: string;
  selecionado?: string | null;
  aoSelecionar?: (codigo: string | null) => void;
  baseInicial?: Base;
  className?: string;
}

// Bases: OpenFreeMap (vetorial, aberto) para ruas; imagens Esri para satélite.
// OpenFreeMap também serve os glifos de texto, então os rótulos não dependem de outro servidor.
const GLIFOS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const BASES = {
  satelite: { rotulo: "Satélite" },
  ruas: { rotulo: "Ruas" },
  claro: { rotulo: "Claro" },
} as const;
export type Base = keyof typeof BASES;

function estilo(base: Base): string | StyleSpecification {
  if (base === "ruas") return "https://tiles.openfreemap.org/styles/liberty";
  if (base === "claro") return "https://tiles.openfreemap.org/styles/positron";
  return {
    version: 8,
    glyphs: GLIFOS,
    sources: {
      base: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 18,
        attribution: "Imagens © Esri, Maxar, Earthstar Geographics",
      },
    },
    layers: [{ id: "base", type: "raster", source: "base", paint: { "raster-saturation": -0.3, "raster-brightness-max": 0.88 } }],
  };
}

const corSituacao = [
  "match", ["get", "situacao"],
  ...Object.entries(SITUACAO_LOTE).flatMap(([k, v]) => [k, v.cor]),
  "#a39e92",
] as unknown as maplibregl.ExpressionSpecification;

function limites(gj: GJ): maplibregl.LngLatBoundsLike {
  const b = new maplibregl.LngLatBounds();
  const visitar = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") b.extend(c as [number, number]);
    else if (Array.isArray(c)) c.forEach(visitar);
  };
  const feats = gj.type === "FeatureCollection" ? gj.features : [gj];
  feats.forEach((f) => f.geometry && "coordinates" in f.geometry && visitar(f.geometry.coordinates));
  return b;
}

const FONTE = ["Noto Sans Regular"];
const FONTE_NEGRITO = ["Noto Sans Bold"];

export function MapaNucleo({ perimetro, quadras, logradouros, lotes, destaque, selecionado, aoSelecionar, baseInicial = "satelite", className }: Props) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const callback = useRef(aoSelecionar);
  const [base, setBase] = useState<Base>(baseInicial);
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null);
  const hover = useRef<string | null>(null);

  useEffect(() => {
    callback.current = aoSelecionar;
  }, [aoSelecionar]);

  useEffect(() => {
    if (!div.current) return;
    maplibregl.setWorkerUrl(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/maplibre/maplibre-gl-worker.mjs`);
    const alvo = destaque ? { type: "FeatureCollection" as const, features: lotes.features.filter((f) => f.properties.codigo === destaque) } : perimetro;
    const enquadramento = { padding: destaque ? 90 : 36, maxZoom: 19 };
    const m = new maplibregl.Map({
      container: div.current,
      style: estilo(base),
      bounds: limites(alvo),
      fitBoundsOptions: enquadramento,
      attributionControl: { compact: true },
      maxZoom: 21,
    });
    // O contêiner pode mudar de tamanho depois de criado (layout ainda assentando): reenquadra.
    const reenquadrar = () => {
      m.resize();
      m.fitBounds(limites(alvo), { ...enquadramento, duration: 0 });
    };
    m.once("load", reenquadrar);
    const observador = new ResizeObserver(() => m.resize());
    observador.observe(div.current);
    m.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 120 }), "bottom-left");
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });

    m.on("load", () => {
      const claro = base !== "satelite";
      const traco = claro ? "#1b1a17" : "#ffffff";
      m.addSource("perimetro", { type: "geojson", data: perimetro });
      m.addSource("quadras", { type: "geojson", data: quadras });
      m.addSource("logradouros", { type: "geojson", data: logradouros });
      m.addSource("lotes", { type: "geojson", data: lotes, promoteId: "codigo" });

      m.addLayer({ id: "perimetro", type: "line", source: "perimetro", paint: { "line-color": claro ? "#b4532a" : "#f3d27a", "line-width": 2.2, "line-dasharray": [3, 2] } });
      m.addLayer({ id: "lotes-preench", type: "fill", source: "lotes", paint: {
        "fill-color": corSituacao,
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "sel"], false], 0.82,
          ["boolean", ["feature-state", "hover"], false], 0.7,
          destaque ? ["case", ["==", ["get", "codigo"], destaque], 0.8, 0.18] : (claro ? 0.55 : 0.5),
        ],
      } });
      m.addLayer({ id: "lotes-borda", type: "line", source: "lotes", paint: {
        "line-color": ["case", ["boolean", ["feature-state", "sel"], false], "#1b1a17", traco],
        "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 2.6, ["boolean", ["feature-state", "hover"], false], 1.8, 0.9],
      } });
      m.addLayer({ id: "quadras", type: "line", source: "quadras", paint: { "line-color": traco, "line-width": 2 } });
      m.addLayer({ id: "rotulo-lote", type: "symbol", source: "lotes", minzoom: 18, layout: {
        "text-field": ["slice", ["get", "codigo"], 4], "text-size": 10.5, "text-font": FONTE_NEGRITO, "text-allow-overlap": false,
      }, paint: { "text-color": "#1b1a17", "text-halo-color": "#fffdf8", "text-halo-width": 1.3 } });
      m.addLayer({ id: "rotulo-rua", type: "symbol", source: "logradouros", layout: {
        "symbol-placement": "line", "text-field": ["get", "nome"], "text-size": 11, "text-font": FONTE, "text-letter-spacing": 0.05,
      }, paint: { "text-color": claro ? "#3a3833" : "#fffdf8", "text-halo-color": claro ? "#fffdf8" : "#1b1a17", "text-halo-width": 1.4 } });

      if (!destaque) {
        m.on("click", "lotes-preench", (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) =>
          callback.current?.(String(e.features?.[0]?.properties?.codigo ?? "")),
        );
        m.on("mousemove", "lotes-preench", (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          const f = e.features?.[0];
          const cod = f ? String(f.properties.codigo) : null;
          if (hover.current && hover.current !== cod) m.setFeatureState({ source: "lotes", id: hover.current }, { hover: false });
          if (cod) {
            m.setFeatureState({ source: "lotes", id: cod }, { hover: true });
            const p = f!.properties as LoteMapa;
            popup.setLngLat(e.lngLat).setHTML(
              `<b style="font-family:var(--font-plex-mono)">${p.codigo}</b><br>${p.ocupante ?? "lote vazio"}<br><span style="color:#6b675e">${Number(p.area_m2).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m²${p.pendencias ? ` · ${p.pendencias} pendência(s)` : ""}</span>`,
            ).addTo(m);
          }
          hover.current = cod;
          m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", "lotes-preench", () => {
          if (hover.current) m.setFeatureState({ source: "lotes", id: hover.current }, { hover: false });
          hover.current = null;
          popup.remove();
          m.getCanvas().style.cursor = "";
        });
      }
    });
    m.on("mousemove", (e) => setCursor({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
    m.on("mouseout", () => setCursor(null));
    mapa.current = m;
    return () => {
      observador.disconnect();
      popup.remove();
      m.remove();
      mapa.current = null;
    };
    // O mapa é recriado só quando a base muda; dados são estáticos por página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const aplicar = () => {
      if (!m.getSource("lotes")) return;
      lotes.features.forEach((f) => m.setFeatureState({ source: "lotes", id: f.properties.codigo }, { sel: f.properties.codigo === selecionado }));
    };
    if (m.isStyleLoaded()) aplicar();
    else m.once("idle", aplicar);
  }, [selecionado, lotes, base]);

  useEffect(() => {
    (mapa.current?.getSource("lotes") as GeoJSONSource | undefined)?.setData(lotes);
  }, [lotes]);

  return (
    <div className={clsx("milimetrado relative overflow-hidden rounded-md border fio bg-papel-200", className)}>
      <div ref={div} className="h-full w-full" />
      <div className="absolute top-2 left-2 flex overflow-hidden rounded border fio-forte bg-papel-50/95 text-[11.5px] font-medium shadow-sm">
        {(Object.keys(BASES) as Base[]).map((b) => (
          <button key={b} onClick={() => setBase(b)} className={clsx("px-2.5 py-1", base === b ? "bg-tinta-900 text-papel-50" : "text-tinta-700 hover:bg-papel-100")}>
            {BASES[b].rotulo}
          </button>
        ))}
      </div>
      {cursor && (
        <div className="mono pointer-events-none absolute right-2 bottom-2 rounded bg-papel-50/90 px-1.5 py-0.5 text-[10px] text-tinta-700">
          {cursor.lat.toFixed(6)}, {cursor.lng.toFixed(6)} · SIRGAS 2000
        </div>
      )}
    </div>
  );
}
