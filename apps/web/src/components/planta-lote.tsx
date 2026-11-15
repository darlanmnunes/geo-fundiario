"use client";

import { useRef } from "react";
import { Download, Printer } from "lucide-react";
import { classeBotao } from "./ui";
import { fmt } from "@/lib/dominio";
import { escalaGrafica, escolherEscala, gerarDxf, intervaloMalha, type PontoPlanta, type VizinhoPlanta } from "@/lib/planta";

export interface DadosPlanta {
  arquivo: string;
  titulo: string;
  imovel: string;
  localizacao: string;
  ocupante: string | null;
  responsavel: string;
  art: string;
  area_m2: number;
  perimetro_m: number;
  data: string | null;
  fuso: number;
  meridianoCentral: number;
  convergenciaGraus: number;
  fatorEscala: number;
  pontos: PontoPlanta[];
  segmentos: { azimute: number; distancia: number; confrontante: string }[];
  vizinhos: VizinhoPlanta[];
  /** Endereço do GeoPackage do núcleo, quando publicado junto com o site. */
  gpkg?: string;
  /** Plano em que a área do selo foi calculada. */
  planoArea: string;
}

// Folha A3 paisagem (420 x 297 mm), em milímetros: margem de 25 mm à esquerda e 10 mm nas demais,
// área de desenho à esquerda, coluna técnica e selo à direita, faixa de coordenadas da folha (A-F, 1-8).
const W = 420, H = 297;
const DES = { x: 25, y: 10, w: 275, h: 277 };
const QUADRO = { x: 300, y: 10, w: 110 };
const ESC = QUADRO.w / 87; // a coluna é desenhada numa largura de 87 e ampliada para os 110 mm da folha
const COL = { x: 0, y: 0, w: 87, h: DES.h / ESC };

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  a.click();
  URL.revokeObjectURL(url);
}

export function PlantaLote({ dados }: { dados: DadosPlanta }) {
  const svg = useRef<SVGSVGElement>(null);
  const { den, centroE, centroN } = escolherEscala(dados.pontos, DES.w - 40, DES.h - 40, 1.15);
  const k = 1000 / den; // mm por metro
  const cx = DES.x + DES.w / 2, cy = DES.y + DES.h / 2;
  const X = (e: number) => cx + (e - centroE) * k;
  const Y = (n: number) => cy - (n - centroN) * k;
  const caminho = (pts: { e: number; n: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${X(p.e).toFixed(2)} ${Y(p.n).toFixed(2)}`).join(" ") + " Z";

  const passo = intervaloMalha(den);
  const eMin = centroE - DES.w / 2 / k, eMax = centroE + DES.w / 2 / k;
  const nMin = centroN - DES.h / 2 / k, nMax = centroN + DES.h / 2 / k;
  const malhaE: number[] = [], malhaN: number[] = [];
  for (let e = Math.ceil(eMin / passo) * passo; e <= eMax; e += passo) malhaE.push(e);
  for (let n = Math.ceil(nMin / passo) * passo; n <= nMax; n += passo) malhaN.push(n);
  const eg = escalaGrafica(den);
  const centroide = { e: dados.pontos.reduce((s, p) => s + p.e, 0) / dados.pontos.length, n: dados.pontos.reduce((s, p) => s + p.n, 0) / dados.pontos.length };
  const curto = (c: string) => c.split("-").slice(-2).join("-");

  const linhaTabela = 3.25;
  const yTabela = COL.y + 78;
  const ySelo = COL.y + COL.h - 46;
  const cabeTabela = Math.floor((ySelo - yTabela - 9) / linhaTabela);
  const pontosTabela = dados.pontos.slice(0, cabeTabela);

  const imprimir = () => window.print();
  const baixarSvg = () => svg.current && baixar(`${dados.arquivo}.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg.current)}`, "image/svg+xml");
  const baixarDxf = () => baixar(`${dados.arquivo}.dxf`, gerarDxf({ titulo: dados.imovel, pontos: dados.pontos, vizinhos: dados.vizinhos, den }), "application/dxf");

  const t = { fontFamily: "Arial, Helvetica, sans-serif", fill: "#000" };
  const celula = (x: number, y: number, w: number, h: number, rotulo: string, valor: string, tam = 2.7) => (
    <g key={rotulo}>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#000" strokeWidth={0.18} />
      <text x={x + 1} y={y + 2.4} fontSize={1.7} {...t} fill="#444">{rotulo}</text>
      <text x={x + w / 2} y={y + h - 1.6} fontSize={tam} textAnchor="middle" {...t}>{valor}</text>
    </g>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={imprimir} className={classeBotao("primario")}><Printer className="size-4" aria-hidden /> Imprimir ou salvar em PDF</button>
        <button type="button" onClick={baixarDxf} className={classeBotao("secundario")}><Download className="size-4" aria-hidden /> Baixar DXF</button>
        <button type="button" onClick={baixarSvg} className={classeBotao("secundario")}><Download className="size-4" aria-hidden /> Baixar SVG</button>
        {dados.gpkg && <a href={dados.gpkg} download className={classeBotao("secundario")}><Download className="size-4" aria-hidden /> Baixar GeoPackage do núcleo (QGIS)</a>}
        <span className="text-[13px] text-texto-3">Folha A3 paisagem, escala 1:{den}. DXF e GeoPackage saem em coordenadas reais.</span>
      </div>
      <div className="overflow-x-auto rounded border border-borda bg-[#e9ecf0] p-3">
        <svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} className="folha-impressao mx-auto block w-full min-w-[900px] max-w-[1320px] bg-white shadow-[0_1px_4px_rgb(27_36_48/0.25)]" role="img" aria-label={`Planta de ${dados.imovel}, escala 1:${den}`}>
          <rect x={0} y={0} width={W} height={H} fill="#fff" />
          <defs>
            <clipPath id="area-desenho"><rect x={DES.x} y={DES.y} width={DES.w} height={DES.h} /></clipPath>
          </defs>

          {/* Malha de coordenadas UTM */}
          <g clipPath="url(#area-desenho)">
            {malhaE.map((e) => <line key={`e${e}`} x1={X(e)} x2={X(e)} y1={DES.y} y2={DES.y + DES.h} stroke="#9aa3ad" strokeWidth={0.12} />)}
            {malhaN.map((n) => <line key={`n${n}`} y1={Y(n)} y2={Y(n)} x1={DES.x} x2={DES.x + DES.w} stroke="#9aa3ad" strokeWidth={0.12} />)}
            {malhaE.map((e) => (
              <g key={`te${e}`}>
                <text x={X(e) - 0.8} y={DES.y + 13} fontSize={1.9} {...t} fill="#444" transform={`rotate(-90 ${X(e) - 0.8} ${DES.y + 13})`}>E={e.toFixed(0)}</text>
                <text x={X(e) - 0.8} y={DES.y + DES.h - 2} fontSize={1.9} {...t} fill="#444" transform={`rotate(-90 ${X(e) - 0.8} ${DES.y + DES.h - 2})`}>E={e.toFixed(0)}</text>
              </g>
            ))}
            {malhaN.map((n) => (
              <g key={`tn${n}`}>
                <text x={DES.x + 1.5} y={Y(n) - 0.8} fontSize={1.9} {...t} fill="#444">N={n.toFixed(0)}</text>
                <text x={DES.x + DES.w - 1.5} y={Y(n) - 0.8} fontSize={1.9} textAnchor="end" {...t} fill="#444">N={n.toFixed(0)}</text>
              </g>
            ))}

            {/* Unidades vizinhas */}
            {dados.vizinhos.map((v) => {
              const c = { e: v.pontos.reduce((s, p) => s + p.e, 0) / v.pontos.length, n: v.pontos.reduce((s, p) => s + p.n, 0) / v.pontos.length };
              return (
                <g key={v.codigo}>
                  <path d={caminho(v.pontos)} fill="#f1f3f5" stroke="#6b7684" strokeWidth={0.2} />
                  <text x={X(c.e)} y={Y(c.n)} fontSize={2.2} textAnchor="middle" {...t} fill="#6b7684">{v.codigo}</text>
                </g>
              );
            })}

            {/* Unidade */}
            <path d={caminho(dados.pontos)} fill="#ff00ff" fillOpacity={0.14} stroke="#000" strokeWidth={0.5} strokeLinejoin="round" />
            {dados.pontos.map((p, i) => {
              const q = dados.pontos[(i + 1) % dados.pontos.length];
              const mx = (X(p.e) + X(q.e)) / 2, my = (Y(p.n) + Y(q.n)) / 2;
              let ang = (Math.atan2(Y(q.n) - Y(p.n), X(q.e) - X(p.e)) * 180) / Math.PI;
              if (ang > 90 || ang < -90) ang += 180;
              const comprimentoMm = Math.hypot(X(q.e) - X(p.e), Y(q.n) - Y(p.n));
              // rótulo do vértice empurrado para fora, na direção oposta ao centro
              const fx = X(p.e) - X(centroide.e), fy = Y(p.n) - Y(centroide.n);
              const f = Math.hypot(fx, fy) || 1;
              return (
                <g key={p.codigo}>
                  {comprimentoMm > 9 && (
                    <text x={mx} y={my - 0.9} fontSize={2} textAnchor="middle" transform={`rotate(${ang.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)})`} {...t}
                      stroke="#fff" strokeWidth={0.5} paintOrder="stroke">{fmt.num(dados.segmentos[i].distancia, 3)} m</text>
                  )}
                  <circle cx={X(p.e)} cy={Y(p.n)} r={0.9} fill="#fff" stroke="#000" strokeWidth={0.25} />
                  <circle cx={X(p.e)} cy={Y(p.n)} r={0.3} fill="#000" />
                  <text x={X(p.e) + (fx / f) * 4.2} y={Y(p.n) + (fy / f) * 4.2 + 0.8} fontSize={2.1} fontWeight="bold" textAnchor="middle" {...t} stroke="#fff" strokeWidth={0.55} paintOrder="stroke">{curto(p.codigo)}</text>
                </g>
              );
            })}
            <text x={X(centroide.e)} y={Y(centroide.n) - 1} fontSize={3} fontWeight="bold" textAnchor="middle" {...t}>{dados.titulo}</text>
            <text x={X(centroide.e)} y={Y(centroide.n) + 3} fontSize={2.4} textAnchor="middle" {...t}>{fmt.num(dados.area_m2)} m²</text>
          </g>

          {/* Molduras e faixa de coordenadas da folha */}
          <rect x={DES.x - 5} y={DES.y - 5} width={DES.w + QUADRO.w + 10} height={DES.h + 10} fill="none" stroke="#000" strokeWidth={0.25} />
          <rect x={DES.x} y={DES.y} width={DES.w + QUADRO.w} height={DES.h} fill="none" stroke="#000" strokeWidth={0.7} />
          <line x1={QUADRO.x} x2={QUADRO.x} y1={DES.y} y2={DES.y + DES.h} stroke="#000" strokeWidth={0.5} />
          {Array.from({ length: 8 }, (_, i) => {
            const passoX = (DES.w + QUADRO.w) / 8, xc = DES.x + passoX * (i + 0.5);
            return (
              <g key={`z${i}`}>
                {i > 0 && <><line x1={DES.x + passoX * i} x2={DES.x + passoX * i} y1={DES.y - 5} y2={DES.y} stroke="#000" strokeWidth={0.25} /><line x1={DES.x + passoX * i} x2={DES.x + passoX * i} y1={DES.y + DES.h} y2={DES.y + DES.h + 5} stroke="#000" strokeWidth={0.25} /></>}
                <text x={xc} y={DES.y - 1.3} fontSize={3} textAnchor="middle" {...t}>{i + 1}</text>
                <text x={xc} y={DES.y + DES.h + 3.9} fontSize={3} textAnchor="middle" {...t}>{i + 1}</text>
              </g>
            );
          })}
          {["A", "B", "C", "D", "E", "F"].map((l, i) => {
            const passoY = DES.h / 6, yc = DES.y + passoY * (i + 0.5) + 1;
            return (
              <g key={l}>
                {i > 0 && <><line x1={DES.x - 5} x2={DES.x} y1={DES.y + passoY * i} y2={DES.y + passoY * i} stroke="#000" strokeWidth={0.25} /><line x1={DES.x + DES.w + QUADRO.w} x2={DES.x + DES.w + QUADRO.w + 5} y1={DES.y + passoY * i} y2={DES.y + passoY * i} stroke="#000" strokeWidth={0.25} /></>}
                <text x={DES.x - 2.5} y={yc} fontSize={3} textAnchor="middle" {...t}>{l}</text>
                <text x={DES.x + DES.w + QUADRO.w + 2.5} y={yc} fontSize={3} textAnchor="middle" {...t}>{l}</text>
              </g>
            );
          })}

          {/* Coluna técnica */}
          <g transform={`translate(${QUADRO.x} ${QUADRO.y}) scale(${ESC})`}>
            <text x={COL.x + COL.w / 2} y={COL.y + 7} fontSize={3.6} fontWeight="bold" textAnchor="middle" {...t}>Geo-Fundiário</text>
            <text x={COL.x + COL.w / 2} y={COL.y + 11.5} fontSize={2.3} textAnchor="middle" {...t}>Regularização Fundiária Urbana (REURB)</text>
            <text x={COL.x + COL.w / 2} y={COL.y + 15} fontSize={2.1} textAnchor="middle" {...t} fill="#444">{dados.localizacao}</text>
            <line x1={COL.x} x2={COL.x + COL.w} y1={COL.y + 18} y2={COL.y + 18} stroke="#000" strokeWidth={0.25} />

            <text x={COL.x + 3} y={COL.y + 23} fontSize={2.5} fontWeight="bold" {...t}>INFORMAÇÕES CARTOGRÁFICAS</text>
            {[
              `Projeção: Universal Transversa de Mercator (UTM), fuso ${dados.fuso} S`,
              `Origem: Equador + 10.000.000 m; MC ${Math.abs(dados.meridianoCentral)}° W Gr. + 500.000 m`,
              "Sistema de referência: SIRGAS 2000 (época 2000,4)",
              `Fator de escala (k): ${fmt.num(dados.fatorEscala, 6)}`,
              `Convergência meridiana (c): ${fmt.gms(dados.convergenciaGraus)}`,
              `Azimutes e distâncias no plano UTM; área: ${dados.planoArea}`,
            ].map((l, i) => <text key={l} x={COL.x + 3} y={COL.y + 27.5 + i * 3.1} fontSize={1.95} {...t}>{l}</text>)}

            {/* Nortes: da quadrícula (vertical) e verdadeiro, em diagrama esquemático (ângulo fora de escala; o valor está escrito ao lado) */}
            <g transform={`translate(${COL.x + COL.w - 9} ${COL.y + 42})`}>
              <line x1={0} y1={0} x2={0} y2={-13} stroke="#000" strokeWidth={0.3} />
              <path d="M0 -15 L-1.2 -11.5 L1.2 -11.5 Z" fill="#000" />
              <text x={0} y={-16} fontSize={1.9} textAnchor="middle" {...t}>NQ</text>
              <g transform={`rotate(${dados.convergenciaGraus < 0 ? 16 : -16})`}>
                <line x1={0} y1={0} x2={0} y2={-11} stroke="#000" strokeWidth={0.2} strokeDasharray="0.8 0.6" />
                <text x={0} y={-12} fontSize={1.9} textAnchor="middle" {...t}>NV</text>
              </g>
            </g>

            <line x1={COL.x} x2={COL.x + COL.w} y1={COL.y + 47} y2={COL.y + 47} stroke="#000" strokeWidth={0.25} />
            <text x={COL.x + 3} y={COL.y + 51.5} fontSize={2.5} fontWeight="bold" {...t}>CONVENÇÕES</text>
            <rect x={COL.x + 3} y={COL.y + 53.5} width={7} height={3} fill="#ff00ff" fillOpacity={0.14} stroke="#000" strokeWidth={0.5} />
            <text x={COL.x + 12} y={COL.y + 56} fontSize={2} {...t}>Unidade</text>
            <rect x={COL.x + 30} y={COL.y + 53.5} width={7} height={3} fill="#f1f3f5" stroke="#6b7684" strokeWidth={0.2} />
            <text x={COL.x + 39} y={COL.y + 56} fontSize={2} {...t}>Unidade vizinha</text>
            <circle cx={COL.x + 64} cy={COL.y + 55} r={0.9} fill="#fff" stroke="#000" strokeWidth={0.25} /><circle cx={COL.x + 64} cy={COL.y + 55} r={0.3} />
            <text x={COL.x + 67} y={COL.y + 56} fontSize={2} {...t}>Vértice</text>

            <text x={COL.x + 3} y={COL.y + 63} fontSize={2.5} fontWeight="bold" {...t}>ESCALA GRÁFICA</text>
            <g transform={`translate(${COL.x + 6} ${COL.y + 65.5})`}>
              {[0, 1, 2, 3].map((i) => <rect key={i} x={(eg.mm / 4) * i} y={0} width={eg.mm / 4} height={1.6} fill={i % 2 ? "#fff" : "#000"} stroke="#000" strokeWidth={0.15} />)}
              {[0, 0.5, 1].map((f) => <text key={f} x={eg.mm * f} y={4.6} fontSize={1.9} textAnchor="middle" {...t}>{fmt.num(eg.total * f, eg.total * f % 1 ? 1 : 0)}{f === 1 ? " m" : ""}</text>)}
            </g>

            <line x1={COL.x} x2={COL.x + COL.w} y1={yTabela - 5} y2={yTabela - 5} stroke="#000" strokeWidth={0.25} />
            <text x={COL.x + 3} y={yTabela - 0.5} fontSize={2.5} fontWeight="bold" {...t}>VÉRTICES E LADOS</text>
            {["Vértice", "E (m)", "N (m)", "Azimute", "Dist. (m)"].map((c, i) => (
              <text key={c} x={COL.x + [3, 33, 52, 67, 85][i]} y={yTabela + 4} fontSize={1.9} fontWeight="bold" textAnchor={i ? "end" : "start"} {...t}>{c}</text>
            ))}
            <line x1={COL.x + 2} x2={COL.x + COL.w - 2} y1={yTabela + 5} y2={yTabela + 5} stroke="#000" strokeWidth={0.15} />
            {pontosTabela.map((p, i) => (
              <g key={p.codigo}>
                <text x={COL.x + 3} y={yTabela + 8 + i * linhaTabela} fontSize={1.9} {...t}>{curto(p.codigo)}</text>
                <text x={COL.x + 33} y={yTabela + 8 + i * linhaTabela} fontSize={1.9} textAnchor="end" {...t}>{fmt.num(p.e, 3)}</text>
                <text x={COL.x + 52} y={yTabela + 8 + i * linhaTabela} fontSize={1.9} textAnchor="end" {...t}>{fmt.num(p.n, 3)}</text>
                <text x={COL.x + 67} y={yTabela + 8 + i * linhaTabela} fontSize={1.9} textAnchor="end" {...t}>{fmt.gms(dados.segmentos[i].azimute)}</text>
                <text x={COL.x + 85} y={yTabela + 8 + i * linhaTabela} fontSize={1.9} textAnchor="end" {...t}>{fmt.num(dados.segmentos[i].distancia, 3)}</text>
              </g>
            ))}
            {dados.pontos.length > cabeTabela && <text x={COL.x + 3} y={ySelo - 1.5} fontSize={1.8} {...t} fill="#444">Demais vértices no memorial descritivo anexo.</text>}

            {/* Selo */}
            {celula(COL.x, ySelo, COL.w, 8, "Título:", "Planta da unidade imobiliária", 3)}
            {celula(COL.x, ySelo + 8, COL.w, 7.5, "Imóvel:", dados.imovel, 2.4)}
            {celula(COL.x, ySelo + 15.5, COL.w, 7.5, dados.ocupante ? "Ocupante:" : "Ocupante:", dados.ocupante ?? "Não identificado", 2.4)}
            {celula(COL.x, ySelo + 23, COL.w, 7.5, "Responsável técnico:", `${dados.responsavel} | ART ${dados.art}`, 1.9)}
            {celula(COL.x, ySelo + 30.5, 29, 7.75, "Área:", `${fmt.num(dados.area_m2)} m²`, 2.6)}
            {celula(COL.x + 29, ySelo + 30.5, 29, 7.75, "Perímetro:", `${fmt.num(dados.perimetro_m)} m`, 2.6)}
            {celula(COL.x + 58, ySelo + 30.5, 29, 7.75, "Escala:", `1:${den}`, 2.6)}
            {celula(COL.x, ySelo + 38.25, 29, 7.75, "Data:", dados.data ? fmt.data(dados.data) : "", 2.6)}
            {celula(COL.x + 29, ySelo + 38.25, 29, 7.75, "Unidade:", "Metros", 2.6)}
            {celula(COL.x + 58, ySelo + 38.25, 14.5, 7.75, "Folha:", "1/1", 2.6)}
            {celula(COL.x + 72.5, ySelo + 38.25, 14.5, 7.75, "Formato:", "A3", 2.6)}
          </g>
          <text x={DES.x} y={H - 1.6} fontSize={2.2} {...t} fill="#666">Peça de demonstração gerada pelo Geo-Fundiário a partir dos vértices cadastrados. Dados fictícios.</text>
        </svg>
      </div>
    </div>
  );
}
