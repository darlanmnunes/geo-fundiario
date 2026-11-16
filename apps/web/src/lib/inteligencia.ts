// Inteligência territorial: vocabulário de severidade. Os dossiês e achados vêm do banco (esquema inteligencia).
import type { Tom } from "./dominio";

export type Severidade = "impede" | "condiciona" | "atencao" | "ok" | "sem_dado";

export interface Achado {
  /** Código do tema no catálogo (inteligencia.camada). */
  codigo?: string | null;
  camada: string;
  fonte: string;
  resultado: string;
  severidade: Severidade;
  implicacao: string | null;
  base: string | null;
  origem: "calculado" | "simulado" | "informado";
  /** Só nos achados consultados ao vivo: feições que sustentam o resultado e tempo de resposta da fonte. */
  evidencias?: GeoJSON.Feature[];
  tempo_ms?: number;
  metricas?: Record<string, unknown>;
  /** Nos achados gravados a partir de uma consulta às fontes: quando a consulta foi feita. */
  consultado_em?: string | null;
}

/** Resposta do diagnóstico territorial (núcleo cadastrado ou área livre). */
export interface Diagnostico {
  consultado_em: string;
  achados: Achado[];
  previstos: { codigo: string; camada: string; fonte: string }[];
  area_ha?: number;
  uf?: string | null;
  municipio_ibge?: string | null;
}

export interface Dossie {
  resumo: string;
  pontuacao: number;
  achados: Achado[];
}

export const SEVERIDADE: Record<Severidade, { rotulo: string; tom: Tom; explicacao: string }> = {
  impede: { rotulo: "Impede", tom: "vermelho", explicacao: "Barra o registro até ser resolvido" },
  condiciona: { rotulo: "Condiciona", tom: "ambar", explicacao: "Exige estudo, obra ou ato antes da aprovação" },
  atencao: { rotulo: "Atenção", tom: "azul", explicacao: "Registrar e acompanhar" },
  sem_dado: { rotulo: "Sem dado", tom: "neutro", explicacao: "Fonte não cobre a área" },
  ok: { rotulo: "Sem restrição", tom: "verde", explicacao: "Nada a fazer" },
};
export const ORDEM_SEVERIDADE: Severidade[] = ["impede", "condiciona", "atencao", "sem_dado", "ok"];
