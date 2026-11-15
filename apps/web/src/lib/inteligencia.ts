// Inteligência territorial: vocabulário de severidade. Os dossiês e achados vêm do banco (esquema inteligencia).
import type { Tom } from "./dominio";

export type Severidade = "impede" | "condiciona" | "atencao" | "ok" | "sem_dado";

export interface Achado {
  camada: string;
  fonte: string;
  resultado: string;
  severidade: Severidade;
  implicacao: string | null;
  base: string | null;
  origem: "calculado" | "simulado" | "informado";
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
