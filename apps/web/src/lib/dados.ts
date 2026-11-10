// Fonte de dados do protótipo: seed fictício gerado por services/api/scripts/gerar_seed.py.
// Em produção, as mesmas estruturas vêm da API (services/api) sobre o PostGIS.
import "server-only";
import seed from "@/data/seed.json";
import type { ItemBusca } from "@/components/paleta-comandos";
import { FASES, TIPO_DOCUMENTO, type CodigoFase, type SituacaoLote } from "./dominio";

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
  idade: number;
  escolaridade: string;
  situacao_profissional: string;
  documentos: string[];
  documentos_pendentes: string[];
}

export interface VerticeLote { codigo: string; e: number; n: number; tipo: string; metodo: string; sigma: number }
export interface SegmentoLote { de: string; para: string; azimute: number; distancia: number; confrontante: string }

export interface Lote {
  codigo: string;
  quadra: number;
  numero: number;
  area_m2: number;
  perimetro_m: number;
  situacao: SituacaoLote;
  edificado: boolean;
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
  resposta: "sem_manifestacao" | "anuencia" | "impugnacao";
  impugnacao: string | null;
}

export interface Assinatura {
  nome: string;
  papel: string;
  metodo: string;
  situacao: "assinado" | "pendente";
  em: string | null;
}

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
  area_nucleo_m2: number;
  perimetro: Feature<Record<string, never>>;
  memorial_perimetro: string;
  quadras: FC<{ codigo: string }>;
  logradouros: FC<{ nome: string }>;
  lotes: FC<Lote>;
  notificacoes: Notificacao[];
  pecas: { tipo: string; situacao: string }[];
  documentos: Documento[];
}

const projetos = (seed as unknown as { projetos: Projeto[] }).projetos;

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

export function indicadores(p: Projeto) {
  const lotes = lotesDe(p);
  const ocupados = lotes.filter((l) => l.ocupante);
  const porSituacao = Object.fromEntries(
    (["levantado", "cadastrado", "notificado", "pendencia", "apto_crf"] as SituacaoLote[]).map((s) => [s, lotes.filter((l) => l.situacao === s).length]),
  ) as Record<SituacaoLote, number>;
  const vertices = new Map<string, { sigma: number }>();
  lotes.forEach((l) => l.vertices.forEach((v) => vertices.set(v.codigo, v)));
  return {
    lotes: lotes.length,
    quadras: p.quadras.features.length,
    edificados: lotes.filter((l) => l.edificado).length,
    familias: ocupados.length,
    pessoas: ocupados.reduce((s, l) => s + (l.ocupante?.composicao_familiar ?? 0), 0),
    areaLotes: lotes.reduce((s, l) => s + l.area_m2, 0),
    pendencias: lotes.reduce((s, l) => s + l.pendencias.length, 0),
    docsPendentes: ocupados.reduce((s, l) => s + (l.ocupante?.documentos_pendentes.length ?? 0), 0),
    porSituacao,
    vertices: vertices.size,
    rendaMediaSm: ocupados.length ? ocupados.reduce((s, l) => s + (l.ocupante?.renda_sm ?? 0), 0) / ocupados.length : 0,
    ateCincoSm: ocupados.filter((l) => (l.ocupante?.renda_sm ?? 99) <= 5).length,
    assinaturasPendentes: p.documentos.reduce((s, d) => s + d.assinaturas.filter((a) => a.situacao === "pendente").length, 0),
  };
}

/** Distribuições para o perfil socioeconômico (contagens por categoria). */
export function perfilSocioeconomico(p: Projeto) {
  const oc = lotesDe(p).flatMap((l) => (l.ocupante ? [l.ocupante] : []));
  const contar = <T extends string>(chaves: T[], f: (o: Ocupante) => T) =>
    chaves.map((k) => ({ chave: k, n: oc.filter((o) => f(o) === k).length }));
  return {
    renda: contar(["ate_1", "1_2", "2_3", "3_5", "acima_5"], (o) =>
      o.renda_sm <= 1 ? "ate_1" : o.renda_sm <= 2 ? "1_2" : o.renda_sm <= 3 ? "2_3" : o.renda_sm <= 5 ? "3_5" : "acima_5",
    ),
    idade: contar(["ate_29", "30_44", "45_59", "60_mais"], (o) => (o.idade <= 29 ? "ate_29" : o.idade <= 44 ? "30_44" : o.idade <= 59 ? "45_59" : "60_mais")),
    escolaridade: contar(["sem_instrucao", "fundamental", "medio", "superior"], (o) => o.escolaridade),
    profissao: contar(["clt", "autonomo", "informal", "aposentado", "servidor", "desempregado"], (o) => o.situacao_profissional),
    total: oc.length,
  };
}

/** Versão leve dos lotes para o mapa (sem memorial, vértices e segmentos). */
export function lotesParaMapa(p: Projeto) {
  return {
    type: "FeatureCollection" as const,
    features: p.lotes.features.map((f) => ({
      type: "Feature" as const,
      geometry: f.geometry as unknown as GeoJSON.Geometry,
      properties: {
        codigo: f.properties.codigo,
        situacao: f.properties.situacao,
        area_m2: f.properties.area_m2,
        ocupante: f.properties.ocupante?.nome ?? null,
        pendencias: f.properties.pendencias.length,
      },
    })),
  };
}

export function camadasBase(p: Projeto) {
  return {
    perimetro: p.perimetro as unknown as GeoJSON.Feature,
    quadras: p.quadras as unknown as GeoJSON.FeatureCollection,
    logradouros: p.logradouros as unknown as GeoJSON.FeatureCollection,
  };
}

function chave(...partes: (string | number | null | undefined)[]) {
  return partes.filter(Boolean).join(" ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Índice da paleta de comandos: páginas, núcleos, lotes, ocupantes, fases e documentos. */
export function indiceBusca(): ItemBusca[] {
  const itens: ItemBusca[] = [
    { tipo: "pagina", titulo: "Mesa de trabalho", detalhe: "Todos os núcleos, prazos e pendências", href: "/", chave: "mesa inicio painel" },
    { tipo: "pagina", titulo: "Inteligência territorial", detalhe: "Dossiê de uma área a partir de camadas públicas", href: "/inteligencia", chave: "inteligencia territorial dossie" },
    { tipo: "pagina", titulo: "Base legal e normas", href: "/legislacao", chave: "base legal lei 13465 normas legislacao" },
  ];
  for (const p of projetos) {
    const curto = p.nome.replace("Núcleo ", "");
    itens.push({ tipo: "projeto", titulo: p.nome, detalhe: `${p.processo_adm} · ${p.municipio}/${p.uf}`, href: `/projetos/${p.id}`, chave: chave(p.nome, p.processo_adm, p.modalidade) });
    for (const f of FASES) itens.push({ tipo: "fase", titulo: f.nome, detalhe: curto, href: `/projetos/${p.id}#fase-${f.codigo}`, chave: chave(f.nome, curto, "fase") });
    for (const l of lotesDe(p)) {
      itens.push({ tipo: "lote", titulo: l.codigo, detalhe: `${curto} · ${l.ocupante?.nome ?? "lote vazio"}`, href: `/projetos/${p.id}/lotes/${l.codigo}`, chave: chave(l.codigo, l.codigo.replace("-", " "), curto) });
      if (l.ocupante) itens.push({ tipo: "pessoa", titulo: l.ocupante.nome, detalhe: `${l.codigo} · ${curto}`, href: `/projetos/${p.id}/lotes/${l.codigo}`, chave: chave(l.ocupante.nome, l.codigo) });
    }
    for (const d of p.documentos) itens.push({ tipo: "documento", titulo: d.titulo, detalhe: `${TIPO_DOCUMENTO[d.tipo]} · ${curto}`, href: `/projetos/${p.id}/documentos#${d.id}`, chave: chave(d.titulo, d.tipo, d.codigo_verificacao, curto) });
  }
  return itens;
}
