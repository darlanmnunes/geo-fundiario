// Ilustrações da página de ajuda: esquemas desenhados em SVG, no mesmo vocabulário de cores da interface.
import { SITUACAO_LOTE } from "@/lib/dominio";

const AZUL = "#1351b4", MARINHO = "#0b2f66", BORDA = "#a9b3c0", TEXTO = "#1b2430", TEXTO2 = "#445061", CLARO = "#e7effb", FUNDO = "#f6f8fa";
const fonte = { fontFamily: "inherit" };

/** O caminho de um núcleo, em cinco blocos. */
export function FiguraCaminho() {
  const passos = [
    { t: "Campo", d: ["Vértices medidos", "Cadastro social"], icone: <path d="M-7 8 L0 -9 L7 8 M-4 1 H4" /> },
    { t: "Cadastro", d: ["Unidades e ocupantes", "Documentos"], icone: <path d="M-8 -6 H8 V8 H-8 Z M-8 -1 H8 M-2 -6 V8" /> },
    { t: "Processo", d: ["Dez fases", "Prazos e notificações"], icone: <path d="M-9 0 H-3 M3 0 H9 M-3 -5 H3 V5 H-3 Z" /> },
    { t: "Peças", d: ["Memoriais e plantas", "CRF"], icone: <path d="M-6 -9 H3 L7 -5 V9 H-6 Z M-3 -2 H4 M-3 2 H4 M-3 6 H1" /> },
    { t: "Registro", d: ["Cartório", "Matrículas abertas"], icone: <path d="M-8 8 H8 M-6 8 V-2 M0 8 V-2 M6 8 V-2 M-9 -2 H9 L0 -9 Z" /> },
  ];
  return (
    <svg viewBox="0 0 760 150" className="w-full" role="img" aria-label="Caminho de um núcleo: campo, cadastro, processo, peças e registro">
      {passos.map((p, i) => {
        const x = 20 + i * 148;
        return (
          <g key={p.t}>
            {i > 0 && <path d={`M${x - 26} 60 H${x - 6} m-6 -5 l6 5 l-6 5`} fill="none" stroke={BORDA} strokeWidth={2} />}
            <rect x={x} y={14} width={122} height={122} rx={4} fill="#fff" stroke={BORDA} />
            <circle cx={x + 61} cy={50} r={20} fill={CLARO} />
            <g transform={`translate(${x + 61} 50)`} fill="none" stroke={AZUL} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">{p.icone}</g>
            <text x={x + 61} y={92} textAnchor="middle" fontSize={15} fontWeight={700} fill={TEXTO} {...fonte}>{i + 1}. {p.t}</text>
            {p.d.map((l, j) => <text key={l} x={x + 61} y={110 + j * 15} textAnchor="middle" fontSize={11.5} fill={TEXTO2} {...fonte}>{l}</text>)}
          </g>
        );
      })}
    </svg>
  );
}

function Marcador({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={11} fill="#ffd23d" stroke={TEXTO} strokeWidth={1} />
      <text x={x} y={y + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXTO} {...fonte}>{n}</text>
    </g>
  );
}

const lotes = [
  [70, 96, 46, 30, "apto_crf"], [122, 100, 40, 34, "apto_crf"], [168, 92, 44, 30, "pendencia"], [84, 140, 50, 30, "cadastrado"],
  [142, 146, 38, 30, "notificado"], [188, 136, 46, 34, "levantado"],
] as const;

function MiniMapa({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#dfe7dc" stroke={BORDA} />
      <path d={`M${x} ${y + h * 0.75} C${x + w * 0.3} ${y + h * 0.55}, ${x + w * 0.6} ${y + h * 0.95}, ${x + w} ${y + h * 0.7}`} stroke="#fff" strokeWidth={7} fill="none" />
      <path d={`M${x + w * 0.78} ${y} C${x + w * 0.7} ${y + h * 0.3}, ${x + w * 0.95} ${y + h * 0.4}, ${x + w} ${y + h * 0.35} V${y} Z`} fill="#b9dcea" />
      {lotes.map(([lx, ly, lw, lh, s], i) => (
        <rect key={i} x={x + (lx - 60) * (w / 190)} y={y + (ly - 84) * (h / 100)} width={lw * (w / 190)} height={lh * (h / 100)} fill={SITUACAO_LOTE[s].cor} fillOpacity={0.85} stroke="#fff" strokeWidth={1} />
      ))}
      <rect x={x + 6} y={y + 6} width={50} height={14} rx={2} fill="#fff" stroke={BORDA} />
      <text x={x + 31} y={y + 16} textAnchor="middle" fontSize={8.5} fill={TEXTO} {...fonte}>Camadas</text>
    </g>
  );
}

/** Esquema da tela Visão geral, com marcadores numerados. */
export function FiguraVisaoGeral() {
  return (
    <svg viewBox="0 0 520 300" className="w-full" role="img" aria-label="Esquema da tela Visão geral com cinco áreas numeradas">
      <rect width={520} height={300} rx={4} fill={FUNDO} stroke={BORDA} />
      <rect width={520} height={24} rx={4} fill={MARINHO} />
      <text x={12} y={16} fontSize={10} fontWeight={700} fill="#fff" {...fonte}>Geo-Fundiário</text>
      <rect x={14} y={34} width={170} height={16} rx={2} fill="#fff" stroke={BORDA} />
      <rect x={14} y={34} width={42} height={16} rx={2} fill={AZUL} />
      {[0, 1, 2, 3, 4, 5].map((i) => <g key={i}><rect x={14 + i * 82.5} y={58} width={80} height={34} fill="#fff" stroke={BORDA} /><rect x={20 + i * 82.5} y={64} width={36} height={4} fill={BORDA} /><rect x={20 + i * 82.5} y={74} width={24} height={9} fill={i === 3 ? "#1c8a2c" : TEXTO} /></g>)}
      <MiniMapa x={14} y={100} w={300} h={140} />
      <rect x={322} y={100} width={184} height={66} fill="#fff" stroke={BORDA} />
      {Object.values(SITUACAO_LOTE).map((s, i) => <rect key={s.rotulo} x={372} y={108 + i * 11} width={[60, 110, 50, 80, 36][i]} height={7} fill={s.cor} />)}
      {Object.values(SITUACAO_LOTE).map((s, i) => <rect key={s.rotulo + "r"} x={330} y={109.5 + i * 11} width={34} height={4} fill={BORDA} />)}
      <rect x={322} y={174} width={184} height={66} fill="#fff" stroke={BORDA} />
      {[0, 1, 2].map((i) => <g key={i}><rect x={330} y={183 + i * 18} width={110} height={4} fill={TEXTO2} /><rect x={330} y={190 + i * 18} width={70} height={3} fill={BORDA} /><rect x={462} y={182 + i * 18} width={36} height={9} rx={2} fill={["#fdf1cf", "#fbe6e3", "#e7effb"][i]} /></g>)}
      <rect x={14} y={248} width={492} height={42} fill="#fff" stroke={BORDA} />
      {[0, 1, 2].map((i) => <g key={i}><rect x={22} y={256 + i * 11} width={90} height={4} fill={AZUL} />{Array.from({ length: 10 }, (_, j) => <rect key={j} x={200 + j * 12} y={255 + i * 11} width={10} height={6} fill={j < [5, 3, 4][i] ? MARINHO : j === [5, 3, 4][i] ? "#ffb000" : BORDA} />)}<rect x={360} y={256 + i * 11} width={60} height={4} fill={BORDA} /></g>)}
      <Marcador x={196} y={42} n={1} />
      <Marcador x={506} y={58} n={2} />
      <Marcador x={300} y={112} n={3} />
      <Marcador x={506} y={108} n={4} />
      <Marcador x={506} y={182} n={5} />
      <Marcador x={506} y={254} n={6} />
    </svg>
  );
}

/** Esquema da tela de um núcleo: processo, mapa e painel da unidade. */
export function FiguraNucleo() {
  return (
    <svg viewBox="0 0 520 250" className="w-full" role="img" aria-label="Esquema da tela de um núcleo com quatro áreas numeradas">
      <rect width={520} height={250} rx={4} fill={FUNDO} stroke={BORDA} />
      <rect width={520} height={24} rx={4} fill={MARINHO} />
      <rect y={24} width={520} height={52} fill="#fff" stroke={BORDA} />
      <rect x={14} y={31} width={64} height={13} rx={2} fill="#fff" stroke={BORDA} /><text x={46} y={40.5} textAnchor="middle" fontSize={8} fill={TEXTO} {...fonte}>← Visão geral</text>
      <rect x={14} y={50} width={150} height={7} fill={TEXTO} />
      {["Mapa e processo", "Cadastro", "Levantamento", "Notificações", "Documentos"].map((a, i) => <text key={a} x={16 + i * 78} y={71} fontSize={8.5} fontWeight={i ? 400 : 700} fill={i ? TEXTO2 : AZUL} {...fonte}>{a}</text>)}
      <rect x={14} y={73.5} width={66} height={2.5} fill={AZUL} />
      <rect x={14} y={86} width={104} height={152} fill="#fff" stroke={BORDA} />
      {Array.from({ length: 10 }, (_, i) => <g key={i}><circle cx={26} cy={98 + i * 14.5} r={5} fill={i < 5 ? MARINHO : i === 5 ? "#ffb000" : "#fff"} stroke={i > 5 ? BORDA : "none"} /><rect x={36} y={96 + i * 14.5} width={[52, 60, 58, 62, 56, 40, 54, 50, 24, 44][i]} height={4} fill={i === 5 ? TEXTO : BORDA} /></g>)}
      <MiniMapa x={126} y={86} w={250} h={152} />
      <rect x={384} y={86} width={122} height={152} fill="#fff" stroke={BORDA} />
      <rect x={392} y={96} width={70} height={6} fill={TEXTO} />
      <rect x={392} y={110} width={9} height={9} fill={SITUACAO_LOTE.pendencia.cor} /><rect x={406} y={112} width={60} height={5} fill={TEXTO2} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={392} y={130 + i * 11} width={[100, 86, 94, 60][i]} height={4} fill={BORDA} />)}
      <rect x={392} y={212} width={106} height={16} rx={2} fill={AZUL} />
      <Marcador x={90} y={38} n={1} />
      <Marcador x={118} y={98} n={2} />
      <Marcador x={364} y={100} n={3} />
      <Marcador x={506} y={100} n={4} />
    </svg>
  );
}

/** O limite de 8 cm: as três componentes do erro e a esfera de tolerância em torno do vértice. */
export function FiguraErroPosicional() {
  return (
    <svg viewBox="0 0 420 220" className="w-full max-w-md" role="img" aria-label="Erro posicional tridimensional: resultante dos desvios em E, N e h, comparada ao raio de 8 centímetros">
      <circle cx={150} cy={118} r={84} fill={CLARO} stroke={AZUL} strokeDasharray="5 4" />
      <ellipse cx={150} cy={118} rx={84} ry={24} fill="none" stroke={AZUL} strokeOpacity={0.45} strokeDasharray="3 4" />
      <text x={150} y={22} textAnchor="middle" fontSize={12} fill={AZUL} fontWeight={700} {...fonte}>limite: raio de 8 cm</text>
      <g stroke={TEXTO} strokeWidth={1.6} fill="none" strokeLinecap="round">
        <path d="M150 118 H206" /><path d="M150 118 L178 96" /><path d="M150 118 V70" />
      </g>
      <path d="M150 118 L206 56" stroke="#b8251a" strokeWidth={2.2} />
      <circle cx={150} cy={118} r={4} fill={TEXTO} />
      <circle cx={206} cy={56} r={3.5} fill="#b8251a" />
      <text x={210} y={124} fontSize={12} fill={TEXTO} {...fonte}>σE</text>
      <text x={182} y={92} fontSize={12} fill={TEXTO} {...fonte}>σN</text>
      <text x={132} y={74} fontSize={12} fill={TEXTO} {...fonte}>σh</text>
      <text x={214} y={52} fontSize={12} fill="#b8251a" fontWeight={700} {...fonte}>erro 3D</text>
      <text x={150} y={140} textAnchor="middle" fontSize={11} fill={TEXTO2} {...fonte}>vértice medido</text>
      <text x={262} y={150} fontSize={13} fill={TEXTO} {...fonte}>erro 3D =</text>
      <text x={262} y={170} fontSize={13} fill={TEXTO} {...fonte}>√(σE² + σN² + σh²)</text>
      <text x={262} y={194} fontSize={12} fill={TEXTO2} {...fonte}>deve ficar em até 8 cm</text>
    </svg>
  );
}

/** As classes do LADM (ISO 19152) e como se ligam no banco. */
export function FiguraLadm() {
  const caixa = (x: number, y: number, w: number, t: string, s: string, cor = "#fff") => (
    <g key={t}>
      <rect x={x} y={y} width={w} height={46} rx={3} fill={cor} stroke={MARINHO} />
      <text x={x + w / 2} y={y + 19} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXTO} {...fonte}>{t}</text>
      <text x={x + w / 2} y={y + 35} textAnchor="middle" fontSize={10.5} fill={TEXTO2} {...fonte}>{s}</text>
    </g>
  );
  const seta = (d: string) => <path key={d} d={d} fill="none" stroke={MARINHO} strokeWidth={1.4} markerEnd="url(#ponta)" />;
  return (
    <svg viewBox="0 0 760 250" className="w-full" role="img" aria-label="Classes do LADM: pessoa, direito, unidade administrativa, unidade espacial, vértice e fonte">
      <defs><marker id="ponta" markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill={MARINHO} /></marker></defs>
      {caixa(10, 30, 150, "Pessoa", "LA_Party: quem")}
      {caixa(210, 30, 170, "Direito ou restrição", "LA_RRR: o quê", CLARO)}
      {caixa(430, 30, 150, "Imóvel", "LA_BAUnit: sobre o quê")}
      {caixa(430, 130, 150, "Unidade espacial", "LA_SpatialUnit: onde")}
      {caixa(630, 130, 120, "Vértice", "LA_Point: medido")}
      {caixa(210, 130, 170, "Fonte", "LA_Source: com que prova")}
      {caixa(10, 130, 150, "Processo de REURB", "módulo: fases e prazos", "#fdf1cf")}
      {seta("M160 53 H208")}{seta("M380 53 H428")}{seta("M505 76 V128")}{seta("M580 153 H628")}{seta("M295 130 V78")}{seta("M160 153 C185 153 185 200 300 200 C420 200 400 190 440 176")}
      <text x={184} y={46} textAnchor="middle" fontSize={10} fill={TEXTO2} {...fonte}>tem</text>
      <text x={404} y={46} textAnchor="middle" fontSize={10} fill={TEXTO2} {...fonte}>sobre</text>
      <text x={540} y={106} textAnchor="middle" fontSize={10} fill={TEXTO2} {...fonte}>ocupa</text>
      <text x={604} y={146} textAnchor="middle" fontSize={10} fill={TEXTO2} {...fonte}>limite</text>
      <text x={330} y={108} textAnchor="middle" fontSize={10} fill={TEXTO2} {...fonte}>fundamenta</text>
      <text x={300} y={216} textAnchor="middle" fontSize={10} fill={TEXTO2} {...fonte}>referencia, sem duplicar</text>
    </svg>
  );
}

/** Como uma pergunta vira resposta no assistente, sem tocar em dados pessoais. */
export function FiguraAssistente() {
  const passos = [
    ["Pergunta", "em português"],
    ["Modelo de linguagem", "escreve um SELECT"],
    ["Validação", "só leitura, só o esquema", "de consulta"],
    ["Banco", "visões sem dados pessoais"],
    ["Resposta", "tabela e o SQL usado"],
  ];
  return (
    <svg viewBox="0 0 760 96" className="w-full" role="img" aria-label="Fluxo do assistente: pergunta, modelo de linguagem, validação, banco e resposta">
      {passos.map((p, i) => {
        const x = 6 + i * 152;
        return (
          <g key={p[0]}>
            {i > 0 && <path d={`M${x - 24} 46 H${x - 6} m-6 -5 l6 5 l-6 5`} fill="none" stroke={BORDA} strokeWidth={2} />}
            <rect x={x} y={10} width={124} height={74} rx={4} fill={i === 2 ? "#fdf1cf" : "#fff"} stroke={BORDA} />
            <text x={x + 62} y={36} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXTO} {...fonte}>{p[0]}</text>
            {p.slice(1).map((l, j) => <text key={l} x={x + 62} y={54 + j * 14} textAnchor="middle" fontSize={11} fill={TEXTO2} {...fonte}>{l}</text>)}
          </g>
        );
      })}
    </svg>
  );
}

/** As três portas de entrada de dados, todas passando pela API e pela auditoria. */
export function FiguraEntrada() {
  const portas = [["Navegador, com login", "situação, pendências,", "cadastro e documentos"], ["QGIS", "GeoPackage do núcleo:", "geometria e atributos"], ["Importação", "vértices medidos em", "campo, com precisão"]];
  return (
    <svg viewBox="0 0 760 190" className="w-full" role="img" aria-label="Dados entram pelo navegador, pelo QGIS ou por importação, passam pela API e são gravados no banco com auditoria">
      {portas.map((p, i) => (
        <g key={p[0]}>
          <rect x={10} y={10 + i * 60} width={200} height={50} rx={4} fill="#fff" stroke={BORDA} />
          <text x={22} y={30 + i * 60} fontSize={13} fontWeight={700} fill={TEXTO} {...fonte}>{p[0]}</text>
          <text x={22} y={46 + i * 60} fontSize={11} fill={TEXTO2} {...fonte}>{p[1]} {p[2]}</text>
          <path d={`M210 ${35 + i * 60} C260 ${35 + i * 60} 260 95 300 95`} fill="none" stroke={BORDA} strokeWidth={2} />
        </g>
      ))}
      <rect x={300} y={55} width={150} height={80} rx={4} fill={CLARO} stroke={AZUL} />
      <text x={375} y={82} textAnchor="middle" fontSize={14} fontWeight={700} fill={TEXTO} {...fonte}>API</text>
      <text x={375} y={100} textAnchor="middle" fontSize={11} fill={TEXTO2} {...fonte}>valida, identifica</text>
      <text x={375} y={114} textAnchor="middle" fontSize={11} fill={TEXTO2} {...fonte}>o autor, aplica regras</text>
      <path d="M450 95 H506 m-6 -5 l6 5 l-6 5" fill="none" stroke={BORDA} strokeWidth={2} />
      <rect x={510} y={30} width={240} height={130} rx={4} fill="#fff" stroke={MARINHO} />
      <text x={630} y={54} textAnchor="middle" fontSize={14} fontWeight={700} fill={TEXTO} {...fonte}>Banco PostgreSQL / PostGIS</text>
      <rect x={524} y={66} width={212} height={36} rx={3} fill={FUNDO} stroke={BORDA} />
      <text x={630} y={81} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={TEXTO} {...fonte}>Cadastro versionado</text>
      <text x={630} y={95} textAnchor="middle" fontSize={10.5} fill={TEXTO2} {...fonte}>nada é sobrescrito</text>
      <rect x={524} y={110} width={212} height={36} rx={3} fill="#fdf1cf" stroke={BORDA} />
      <text x={630} y={125} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={TEXTO} {...fonte}>Auditoria</text>
      <text x={630} y={139} textAnchor="middle" fontSize={10.5} fill={TEXTO2} {...fonte}>quem, quando, antes e depois</text>
    </svg>
  );
}

/** Camadas do sistema: interface, API, banco com seus esquemas, armazenamento de arquivos e fontes externas. */
export function FiguraArquitetura() {
  const esquemas = [["ladm", "pessoas, direitos,", "unidades, vértices"], ["reurb", "processo, fases,", "prazos, pendências"], ["campo", "levantamento e", "cadastro social"], ["documentos", "metadados, vínculos,", "assinaturas"], ["inteligencia", "fontes, conectores,", "dossiês"], ["acesso", "usuários e", "sessões"], ["auditoria", "toda alteração,", "só inclusão"], ["metadados", "MGB 2.0,", "ISO 19115"]];
  return (
    <svg viewBox="0 0 760 330" className="w-full" role="img" aria-label="Arquitetura: interface no navegador, API, banco PostgreSQL com oito esquemas, armazenamento de arquivos e fontes externas">
      <defs><marker id="pa" markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill={MARINHO} /></marker></defs>
      <rect x={10} y={10} width={230} height={62} rx={4} fill="#fff" stroke={BORDA} />
      <text x={125} y={34} textAnchor="middle" fontSize={13.5} fontWeight={700} fill={TEXTO} {...fonte}>Interface no navegador</text>
      <text x={125} y={52} textAnchor="middle" fontSize={11} fill={TEXTO2} {...fonte}>painel, mapas, fichas, peças (PDF, DOCX, DXF)</text>
      <rect x={265} y={10} width={230} height={62} rx={4} fill="#fff" stroke={BORDA} />
      <text x={380} y={34} textAnchor="middle" fontSize={13.5} fontWeight={700} fill={TEXTO} {...fonte}>QGIS e outros SIG</text>
      <text x={380} y={52} textAnchor="middle" fontSize={11} fill={TEXTO2} {...fonte}>GeoPackage do núcleo</text>
      <rect x={520} y={10} width={230} height={62} rx={4} fill="#fff" stroke={BORDA} />
      <text x={635} y={34} textAnchor="middle" fontSize={13.5} fontWeight={700} fill={TEXTO} {...fonte}>Assistente IA</text>
      <text x={635} y={52} textAnchor="middle" fontSize={11} fill={TEXTO2} {...fonte}>só o esquema de consulta, sem dados pessoais</text>
      {[125, 380, 635].map((x) => <path key={x} d={`M${x} 72 V98`} stroke={MARINHO} strokeWidth={1.4} markerEnd="url(#pa)" />)}
      <rect x={10} y={100} width={740} height={50} rx={4} fill={CLARO} stroke={AZUL} />
      <text x={380} y={122} textAnchor="middle" fontSize={14} fontWeight={700} fill={TEXTO} {...fonte}>API (única que grava)</text>
      <text x={380} y={139} textAnchor="middle" fontSize={11} fill={TEXTO2} {...fonte}>login e perfis, validação, regras do processo, limite de requisições, conectores do diagnóstico</text>
      <path d="M300 150 V176" stroke={MARINHO} strokeWidth={1.4} markerEnd="url(#pa)" />
      <path d="M668 150 V176" stroke={MARINHO} strokeWidth={1.4} markerEnd="url(#pa)" />
      <rect x={10} y={178} width={570} height={142} rx={4} fill="#fff" stroke={MARINHO} />
      <text x={22} y={198} fontSize={13.5} fontWeight={700} fill={TEXTO} {...fonte}>PostgreSQL com PostGIS: um esquema por assunto</text>
      {esquemas.map((e, i) => {
        const x = 22 + (i % 4) * 138, y = 208 + Math.floor(i / 4) * 54;
        return (
          <g key={e[0]}>
            <rect x={x} y={y} width={130} height={46} rx={3} fill={e[0] === "ladm" ? CLARO : e[0] === "auditoria" ? "#fdf1cf" : FUNDO} stroke={BORDA} />
            <text x={x + 8} y={y + 15} fontSize={12} fontWeight={700} fill={TEXTO} fontFamily="ui-monospace, monospace">{e[0]}</text>
            <text x={x + 8} y={y + 28} fontSize={10} fill={TEXTO2} {...fonte}>{e[1]}</text>
            <text x={x + 8} y={y + 40} fontSize={10} fill={TEXTO2} {...fonte}>{e[2]}</text>
          </g>
        );
      })}
      <rect x={596} y={178} width={154} height={64} rx={4} fill="#fff" stroke={MARINHO} />
      <text x={673} y={200} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={TEXTO} {...fonte}>Arquivos</text>
      <text x={673} y={216} textAnchor="middle" fontSize={10.5} fill={TEXTO2} {...fonte}>PDF e fotos fora do banco,</text>
      <text x={673} y={230} textAnchor="middle" fontSize={10.5} fill={TEXTO2} {...fonte}>por SHA-256 (disco ou S3)</text>
      <rect x={596} y={256} width={154} height={64} rx={4} fill="#fff" stroke={BORDA} strokeDasharray="5 3" />
      <text x={673} y={278} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={TEXTO} {...fonte}>Fontes externas</text>
      <text x={673} y={294} textAnchor="middle" fontSize={10.5} fill={TEXTO2} {...fonte}>IBGE, ANA, SGB, SICAR,</text>
      <text x={673} y={308} textAnchor="middle" fontSize={10.5} fill={TEXTO2} {...fonte}>SIGEF, ICMBio, OSM</text>
    </svg>
  );
}
