// Fonte de dados da interface: o banco PostgreSQL/PostGIS, por um de dois caminhos.
//   - GEOF_API_URL definido: lê a API ao vivo (GET /instantaneo) quando o servidor sobe ou o site é gerado.
//   - sem a variável (demonstração estática): lê o instantâneo exportado do banco por
//     services/api/scripts/exportar_instantaneo.py.
// Não existe dado criado aqui.
import "server-only";
import local from "@/data/instantaneo.json";
import type { ItemBusca } from "@/components/paleta-comandos";
import { FASES, TIPO_DOCUMENTO, erroDaNorma, SITUACOES, type CodigoFase, type NormaPrecisao, type SituacaoLote } from "./dominio";
import type { Dossie } from "./inteligencia";

type Geometria = { type: string; coordinates: unknown };
export type Feature<P> = { type: "Feature"; geometry: Geometria; properties: P };
export type FC<P> = { type: "FeatureCollection"; features: Feature<P>[] };

export interface Ocupante {
  nome: string;
  cpf_mascarado: string;
  renda_familiar: number;
  renda_sm: number;
  composicao_familiar: number;
  tempo_ocupacao_anos: number;
  uso: string;
  pcd: boolean;
  possui_outro_imovel: boolean;
  idade: number | null;
  escolaridade: string;
  situacao_profissional: string;
  documentos: string[];
  documentos_pendentes: string[];
  arquivos: Arquivo[];
}

export interface Arquivo { id: string; tipo: string; titulo: string; nome_arquivo: string; mime: string; tamanho_kb: number; data: string | null; codigo_verificacao: string | null }

export interface VerticeLote { codigo: string; e: number; n: number; h: number; tipo: string; metodo: string; sigma_e: number; sigma_n: number; sigma_h: number }
export interface SegmentoLote { de: string; para: string; azimute: number; distancia: number; confrontante: string }

export interface Lote {
  id: number;
  codigo: string;
  quadra: number;
  numero: number;
  area_m2: number;
  perimetro_m: number;
  /** Área e perímetro no Sistema Geodésico Local (plano topográfico), sem a deformação da projeção. */
  area_sgl_m2: number;
  perimetro_sgl_m: number;
  situacao: SituacaoLote;
  ocupante: Ocupante | null;
  pendencias: string[];
  vertices: VerticeLote[];
  segmentos: SegmentoLote[];
  memorial: string;
}

export interface FaseProjeto {
  codigo: CodigoFase;
  situacao: "pendente" | "em_andamento" | "concluida" | "bloqueada";
  iniciada_em: string | null;
  concluida_em: string | null;
  prazo_em: string | null;
}

export interface Notificacao {
  destinatario: string;
  papel: string;
  meio: string;
  enviada_em: string;
  recebida_em: string;
  prazo_fim: string;
  resposta: "sem_manifestacao" | "anuencia" | "impugnacao" | null;
  impugnacao: string | null;
}

export interface Assinatura { nome: string; papel: string; metodo: string; situacao: "assinado" | "pendente"; em: string | null }

export interface Documento {
  id: string;
  fase: CodigoFase;
  tipo: string;
  titulo: string;
  data: string;
  paginas: number;
  tamanho_kb: number;
  codigo_verificacao: string;
  origem: "emitido" | "upload";
  assinaturas: Assinatura[];
}

export interface Cartografia { altitude_media: number; fuso: number; meridiano_central: number; lon: number; lat: number; convergencia_graus: number; fator_escala: number }

export interface Projeto {
  id: number;
  nome: string;
  modalidade: string;
  legitimado: string;
  processo_adm: string;
  municipio: string;
  uf: string;
  municipio_ibge: string;
  srid_utm: number;
  responsavel_tecnico: string;
  art_rrt: string;
  fase_atual: CodigoFase;
  fases: FaseProjeto[];
  levantamento: { equipamento: string | null; norma: string | null; data_inicio: string | null; data_fim: string | null };
  precisao: NormaPrecisao;
  plano_calculo: "utm" | "sgl";
  cartografia: Cartografia;
  area_nucleo_m2: number;
  perimetro: Feature<Record<string, never>>;
  memorial_perimetro: string;
  quadras: FC<{ codigo: string }>;
  logradouros: FC<{ nome: string }>;
  hidrografia: FC<{ nome: string }>;
  faixa_app: Geometria | null;
  lotes: FC<Lote>;
  notificacoes: Notificacao[];
  pecas: { tipo: string; situacao: string }[];
  documentos: Documento[];
  dossie: Dossie | null;
}

interface Pacote {
  aviso: string;
  origem: string;
  ultima_alteracao: string | null;
  camadas: { nome: string; fonte: string; base: string; conector: string | null; endpoint: string | null; situacao: "ao_vivo" | "previsto" }[];
  projetos: Projeto[];
}

async function carregar(): Promise<Pacote & { viaApi: boolean }> {
  const api = process.env.GEOF_API_URL?.replace(/\/$/, "");
  if (api) {
    try {
      const token = process.env.GEOF_API_TOKEN;
      const r = await fetch(`${api}/instantaneo`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { ...((await r.json()) as Pacote), viaApi: true };
    } catch (erro) {
      console.warn(`[dados] API indisponível em ${api} (${String(erro)}); usando o instantâneo local.`);
    }
  }
  return { ...(local as unknown as Pacote), viaApi: false };
}

const pacote = await carregar();
const projetos = pacote.projetos;

export function origemDados() {
  return { viaApi: pacote.viaApi, ultimaAlteracao: pacote.ultima_alteracao };
}

export function camadasConsultadas() {
  return pacote.camadas;
}

export function listarProjetos(): Projeto[] {
  return projetos;
}

export function obterProjeto(id: number | string): Projeto | undefined {
  return projetos.find((p) => p.id === Number(id));
}

export function lotesDe(p: Projeto): Lote[] {
  return p.lotes.features.map((f) => f.properties);
}

export function obterLote(p: Projeto, codigo: string): Lote | undefined {
  return lotesDe(p).find((l) => l.codigo === codigo);
}

/** Vértices do núcleo sem repetição (o mesmo vértice serve a mais de uma unidade). */
export function verticesDe(p: Projeto) {
  const mapa = new Map<string, { codigo: string; tipo: string; metodo: string; erro: number; lotes: string[] }>();
  for (const l of lotesDe(p)) {
    for (const v of l.vertices) {
      const atual = mapa.get(v.codigo) ?? { codigo: v.codigo, tipo: v.tipo, metodo: v.metodo, erro: erroDaNorma(v, p.precisao), lotes: [] };
      atual.lotes.push(l.codigo);
      mapa.set(v.codigo, atual);
    }
  }
  return [...mapa.values()];
}

export function indicadores(p: Projeto) {
  const lotes = lotesDe(p);
  const ocupados = lotes.filter((l) => l.ocupante);
  const porSituacao = Object.fromEntries(SITUACOES.map((s) => [s, lotes.filter((l) => l.situacao === s).length])) as Record<SituacaoLote, number>;
  const vertices = verticesDe(p);
  return {
    lotes: lotes.length,
    quadras: p.quadras.features.length,
    familias: ocupados.length,
    pessoas: ocupados.reduce((s, l) => s + (l.ocupante?.composicao_familiar ?? 0), 0),
    areaLotes: lotes.reduce((s, l) => s + l.area_m2, 0),
    pendencias: lotes.reduce((s, l) => s + l.pendencias.length, 0),
    docsPendentes: ocupados.reduce((s, l) => s + (l.ocupante?.documentos_pendentes.length ?? 0), 0),
    porSituacao,
    vertices: vertices.length,
    verticesFora: vertices.filter((v) => v.erro > p.precisao.tolerancia_m).length,
    rendaMediaSm: ocupados.length ? ocupados.reduce((s, l) => s + (l.ocupante?.renda_sm ?? 0), 0) / ocupados.length : 0,
    assinaturasPendentes: p.documentos.reduce((s, d) => s + d.assinaturas.filter((a) => a.situacao === "pendente").length, 0),
    impugnacoes: p.notificacoes.filter((n) => n.resposta === "impugnacao").length,
  };
}

export const faixaRenda = (sm: number) => (sm <= 1 ? "ate_1" : sm <= 2 ? "1_2" : sm <= 3 ? "2_3" : sm <= 5 ? "3_5" : "acima_5");
export const faixaIdade = (i: number) => (i <= 29 ? "ate_29" : i <= 44 ? "30_44" : i <= 59 ? "45_59" : "60_mais");

/** Distribuições para o perfil socioeconômico (contagens por categoria). */
export function perfilSocioeconomico(p: Projeto) {
  const oc = lotesDe(p).flatMap((l) => (l.ocupante ? [l.ocupante] : []));
  const contar = (chaves: string[], f: (o: Ocupante) => string) => chaves.map((k) => ({ chave: k, n: oc.filter((o) => f(o) === k).length }));
  return {
    renda: contar(["ate_1", "1_2", "2_3", "3_5", "acima_5"], (o) => faixaRenda(o.renda_sm)),
    idade: contar(["ate_29", "30_44", "45_59", "60_mais"], (o) => faixaIdade(o.idade ?? 0)),
    escolaridade: contar(["sem_instrucao", "fundamental", "medio", "superior"], (o) => o.escolaridade),
    profissao: contar(["clt", "autonomo", "informal", "aposentado", "servidor", "desempregado"], (o) => o.situacao_profissional),
    total: oc.length,
  };
}

export interface LoteMapa {
  uid: string; // "<núcleo>:<código>": o código da unidade se repete entre núcleos
  projeto: number;
  nucleo: string;
  codigo: string;
  situacao: string;
  area_m2: number;
  ocupante: string | null;
  pendencias: number;
}

/** Versão leve das unidades para o mapa (sem memorial, vértices e segmentos). */
export function lotesParaMapa(p: Projeto): GeoJSON.FeatureCollection<GeoJSON.Geometry, LoteMapa> {
  return {
    type: "FeatureCollection",
    features: p.lotes.features.map((f) => ({
      type: "Feature" as const,
      geometry: f.geometry as unknown as GeoJSON.Geometry,
      properties: {
        uid: `${p.id}:${f.properties.codigo}`,
        projeto: p.id,
        nucleo: p.nome,
        codigo: f.properties.codigo,
        situacao: f.properties.situacao,
        area_m2: f.properties.area_m2,
        ocupante: f.properties.ocupante?.nome ?? null,
        pendencias: f.properties.pendencias.length,
      },
    })),
  };
}

export interface CamadasMapa {
  perimetros: GeoJSON.FeatureCollection;
  quadras: GeoJSON.FeatureCollection;
  logradouros: GeoJSON.FeatureCollection;
  hidrografia: GeoJSON.FeatureCollection;
  faixaApp: GeoJSON.FeatureCollection;
  lotes: GeoJSON.FeatureCollection<GeoJSON.Geometry, LoteMapa>;
}

/** Camadas de um ou mais núcleos, prontas para o componente de mapa. */
export function camadasMapa(lista: Projeto[]): CamadasMapa {
  const fc = <T,>(features: T[]) => ({ type: "FeatureCollection" as const, features }) as unknown as GeoJSON.FeatureCollection;
  return {
    perimetros: fc(lista.map((p) => ({ ...p.perimetro, properties: { projeto: p.id, nome: p.nome } }))),
    quadras: fc(lista.flatMap((p) => p.quadras.features)),
    logradouros: fc(lista.flatMap((p) => p.logradouros.features)),
    hidrografia: fc(lista.flatMap((p) => p.hidrografia.features)),
    faixaApp: fc(lista.flatMap((p) => (p.faixa_app ? [{ type: "Feature", geometry: p.faixa_app, properties: { projeto: p.id } }] : []))),
    lotes: { type: "FeatureCollection", features: lista.flatMap((p) => lotesParaMapa(p).features) },
  };
}

function chave(...partes: (string | number | null | undefined)[]) {
  return partes.filter(Boolean).join(" ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Índice da busca: páginas, núcleos, unidades, ocupantes, fases e documentos. */
export function indiceBusca(): ItemBusca[] {
  const itens: ItemBusca[] = [
    { tipo: "pagina", titulo: "Visão geral", detalhe: "Painel de todos os núcleos, prazos e pendências", href: "/", chave: "visao geral painel inicio dashboard" },
    { tipo: "pagina", titulo: "Inteligência territorial", detalhe: "Dossiê de cada área a partir de camadas públicas", href: "/inteligencia", chave: "inteligencia territorial dossie" },
    { tipo: "pagina", titulo: "Base legal", detalhe: "Fases do processo, leis e normas", href: "/legislacao", chave: "base legal lei 13465 normas legislacao" },
    { tipo: "pagina", titulo: "Assistente IA", detalhe: "Perguntas ao banco em linguagem natural", href: "/assistente", chave: "assistente consulta chat pergunta" },
    { tipo: "pagina", titulo: "Ajuda", detalhe: "Como o sistema funciona e como usar", href: "/ajuda", chave: "ajuda como funciona usar manual" },
  ];
  for (const p of projetos) {
    const curto = p.nome.replace("Núcleo ", "");
    itens.push({ tipo: "projeto", titulo: p.nome, detalhe: `${p.processo_adm} - ${p.municipio}/${p.uf}`, href: `/projetos/${p.id}`, chave: chave(p.nome, p.processo_adm, p.modalidade) });
    for (const f of FASES) itens.push({ tipo: "fase", titulo: f.nome, detalhe: curto, href: `/projetos/${p.id}#fase-${f.codigo}`, chave: chave(f.nome, curto, "fase") });
    for (const l of lotesDe(p)) {
      itens.push({ tipo: "lote", titulo: l.codigo, detalhe: `${curto} - ${l.ocupante?.nome ?? "sem ocupante identificado"}`, href: `/projetos/${p.id}/lotes/${l.codigo}`, chave: chave(l.codigo, l.codigo.replace("-", " "), curto) });
      if (l.ocupante) itens.push({ tipo: "pessoa", titulo: l.ocupante.nome, detalhe: `${l.codigo} - ${curto}`, href: `/projetos/${p.id}/lotes/${l.codigo}`, chave: chave(l.ocupante.nome, l.codigo) });
    }
    for (const d of p.documentos) itens.push({ tipo: "documento", titulo: d.titulo, detalhe: `${TIPO_DOCUMENTO[d.tipo]} - ${curto}`, href: `/projetos/${p.id}/documentos#${d.id}`, chave: chave(d.titulo, d.tipo, d.codigo_verificacao, curto) });
  }
  return itens;
}
