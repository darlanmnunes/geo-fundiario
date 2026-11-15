// Planta da unidade: escolha de escala, malha de coordenadas e exportação em DXF.
// Tudo no plano UTM do projeto (E, N em metros), o mesmo dos vértices medidos.

export interface PontoPlanta { codigo: string; e: number; n: number }
export interface VizinhoPlanta { codigo: string; pontos: { e: number; n: number }[] }

const ESCALAS = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1250, 1500, 2000, 2500, 5000];

/** Menor denominador de escala usual em que a unidade cabe na área de desenho (mm), com folga para o entorno. */
export function escolherEscala(pontos: { e: number; n: number }[], larguraMm: number, alturaMm: number, folga = 1.45) {
  const es = pontos.map((p) => p.e), ns = pontos.map((p) => p.n);
  const dE = Math.max(...es) - Math.min(...es), dN = Math.max(...ns) - Math.min(...ns);
  const den = ESCALAS.find((d) => (dE * folga * 1000) / d <= larguraMm && (dN * folga * 1000) / d <= alturaMm) ?? ESCALAS[ESCALAS.length - 1];
  return { den, centroE: (Math.max(...es) + Math.min(...es)) / 2, centroN: (Math.max(...ns) + Math.min(...ns)) / 2 };
}

/** Intervalo da malha de coordenadas (m) para que as linhas fiquem a uns 4 a 6 cm no papel. */
export function intervaloMalha(den: number) {
  const alvo = (45 * den) / 1000;
  return [5, 10, 20, 25, 50, 100, 200, 250, 500].reduce((m, v) => (Math.abs(v - alvo) < Math.abs(m - alvo) ? v : m));
}

/** Comprimento total da escala gráfica (m): número redondo que ocupe perto de 50 mm. */
export function escalaGrafica(den: number) {
  const alvo = (50 * den) / 1000;
  const total = [2, 4, 5, 10, 20, 25, 40, 50, 100, 200, 250].reduce((m, v) => (Math.abs(v - alvo) < Math.abs(m - alvo) ? v : m));
  return { total, mm: (total * 1000) / den };
}

const n3 = (v: number) => v.toFixed(3);

/**
 * DXF (AutoCAD R12, ASCII) com a unidade em coordenadas UTM reais: limite fechado, vértices com código,
 * comprimento dos lados e unidades vizinhas, cada coisa na sua camada. Abre em AutoCAD, QGIS, LibreCAD.
 */
export function gerarDxf({ titulo, pontos, vizinhos, den }: { titulo: string; pontos: PontoPlanta[]; vizinhos: VizinhoPlanta[]; den: number }) {
  const h = (2.2 * den) / 1000; // altura de texto que imprime com 2,2 mm na escala da planta
  const linhas: (string | number)[] = [];
  const par = (c: number, v: string | number) => linhas.push(c, v);
  const camadas: [string, number][] = [["LIMITE", 7], ["VERTICES", 1], ["MEDIDAS", 5], ["VIZINHOS", 8], ["TEXTOS", 7]];

  par(0, "SECTION"); par(2, "HEADER");
  par(9, "$ACADVER"); par(1, "AC1009");
  par(9, "$INSUNITS"); par(70, 6); // metros
  par(0, "ENDSEC");
  par(0, "SECTION"); par(2, "TABLES");
  par(0, "TABLE"); par(2, "LAYER"); par(70, camadas.length);
  for (const [nome, cor] of camadas) { par(0, "LAYER"); par(2, nome); par(70, 0); par(62, cor); par(6, "CONTINUOUS"); }
  par(0, "ENDTAB"); par(0, "ENDSEC");
  par(0, "SECTION"); par(2, "ENTITIES");

  const polilinha = (camada: string, pts: { e: number; n: number }[]) => {
    par(0, "POLYLINE"); par(8, camada); par(66, 1); par(70, 1);
    for (const p of pts) { par(0, "VERTEX"); par(8, camada); par(10, n3(p.e)); par(20, n3(p.n)); par(30, "0.0"); }
    par(0, "SEQEND");
  };
  const texto = (camada: string, e: number, n: number, t: string, altura = h, rot = 0) => {
    par(0, "TEXT"); par(8, camada); par(10, n3(e)); par(20, n3(n)); par(30, "0.0"); par(40, altura.toFixed(3)); par(1, t);
    if (rot) par(50, rot.toFixed(4));
  };

  for (const v of vizinhos) polilinha("VIZINHOS", v.pontos);
  polilinha("LIMITE", pontos);
  pontos.forEach((p, i) => {
    par(0, "POINT"); par(8, "VERTICES"); par(10, n3(p.e)); par(20, n3(p.n)); par(30, "0.0");
    texto("VERTICES", p.e + h * 0.4, p.n + h * 0.4, p.codigo);
    const q = pontos[(i + 1) % pontos.length];
    const dist = Math.hypot(q.e - p.e, q.n - p.n);
    let ang = (Math.atan2(q.n - p.n, q.e - p.e) * 180) / Math.PI;
    if (ang > 90 || ang < -90) ang += 180;
    texto("MEDIDAS", (p.e + q.e) / 2, (p.n + q.n) / 2, `${dist.toFixed(3)} m`, h * 0.85, ang);
  });
  const topo = Math.max(...pontos.map((p) => p.n)), esq = Math.min(...pontos.map((p) => p.e));
  texto("TEXTOS", esq, topo + h * 4, titulo, h * 1.4);
  texto("TEXTOS", esq, topo + h * 2.2, "SIRGAS 2000 / UTM - coordenadas em metros", h);

  par(0, "ENDSEC"); par(0, "EOF");
  return linhas.join("\r\n") + "\r\n";
}
