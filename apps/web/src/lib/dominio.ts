// Vocabulário do domínio REURB — espelha o catálogo do banco (db/migrations/003 e 006).

export type CodigoFase =
  | "diagnostico" | "requerimento" | "classificacao" | "levantamento" | "notificacao"
  | "projeto" | "saneamento" | "aprovacao" | "crf" | "registro";

export interface Fase {
  codigo: CodigoFase;
  nome: string;
  curto: string;
  tipo: "legal" | "tecnica";
  baseLegal: string | null;
  prazoDias: number | null;
  descricao: string;
  entregas: string[];
}

export const FASES: Fase[] = [
  { codigo: "diagnostico", nome: "Diagnóstico e planejamento", curto: "Diagnóstico", tipo: "tecnica", baseLegal: null, prazoDias: null,
    descricao: "Delimitação preliminar do núcleo, verificação do marco temporal (22/12/2016), bases cartográficas e plano de campo.",
    entregas: ["Poligonal preliminar", "Bases cartográficas e ortofoto", "Plano de trabalho"] },
  { codigo: "requerimento", nome: "Requerimento e instauração", curto: "Requerimento", tipo: "legal", baseLegal: "Lei 13.465/2017, art. 14; art. 28, I; art. 32", prazoDias: null,
    descricao: "Requerimento do legitimado e instauração do processo administrativo pelo Município.",
    entregas: ["Requerimento", "Delimitação preliminar", "Ato de instauração"] },
  { codigo: "classificacao", nome: "Classificação da modalidade", curto: "Classificação", tipo: "legal", baseLegal: "Lei 13.465/2017, art. 13; art. 30, §§2º-3º; Dec. 9.310/2018, arts. 5º, 6º e 23", prazoDias: 180,
    descricao: "REURB-S (baixa renda, até 5 salários mínimos) ou REURB-E. Sem decisão em 180 dias, vale a modalidade indicada pelo requerente.",
    entregas: ["Ato de classificação", "Cadastro socioeconômico amostral"] },
  { codigo: "levantamento", nome: "Levantamento de campo", curto: "Levantamento", tipo: "tecnica", baseLegal: "Lei 13.465/2017, art. 35, I; Dec. 9.310/2018, arts. 28-29", prazoDias: null,
    descricao: "Planialtimétrico cadastral georreferenciado ao SGB (SIRGAS 2000), erro posicional esférico ≤ 8 cm por vértice, e cadastro socioeconômico imóvel a imóvel.",
    entregas: ["Vértices com precisão", "Lotes, quadras e edificações", "Cadastro social", "ART/RRT"] },
  { codigo: "notificacao", nome: "Buscas e notificações", curto: "Notificações", tipo: "legal", baseLegal: "Lei 13.465/2017, art. 31; Dec. 9.310/2018, art. 24", prazoDias: 30,
    descricao: "Buscas nas matrículas atingidas e notificação de titulares, confrontantes e terceiros, por AR ou edital. 30 dias para impugnar; silêncio vale como concordância.",
    entregas: ["Certidões das matrículas", "Notificações e ARs", "Edital"] },
  { codigo: "projeto", nome: "Projeto de regularização", curto: "Projeto", tipo: "legal", baseLegal: "Lei 13.465/2017, arts. 35-39; Dec. 9.310/2018, arts. 30-32; Lei 12.651/2012, arts. 64-65", prazoDias: null,
    descricao: "Plantas, memoriais, projeto urbanístico, estudos técnicos ambiental e de risco, cronograma de obras e termo de compromisso.",
    entregas: ["Planta do perímetro", "Memoriais descritivos", "Projeto urbanístico", "Estudos técnicos", "Cronograma"] },
  { codigo: "saneamento", nome: "Saneamento e impugnações", curto: "Saneamento", tipo: "legal", baseLegal: "Lei 13.465/2017, art. 28, IV; arts. 21, 31 §3º e 34; Dec. 9.310/2018, art. 24 §§10-12", prazoDias: null,
    descricao: "Análise das impugnações, mediação e câmaras de prevenção e resolução de conflitos. Recurso em 15 dias.",
    entregas: ["Pareceres", "Acordos", "Termo de compromisso"] },
  { codigo: "aprovacao", nome: "Decisão e aprovação", curto: "Aprovação", tipo: "legal", baseLegal: "Lei 13.465/2017, art. 28, V; art. 40", prazoDias: null,
    descricao: "Ato formal da autoridade competente que aprova o projeto, indica as intervenções e identifica os ocupantes.",
    entregas: ["Decreto ou portaria de aprovação", "Publicação"] },
  { codigo: "crf", nome: "Emissão da CRF", curto: "CRF", tipo: "legal", baseLegal: "Lei 13.465/2017, art. 28, VI; art. 41; Dec. 9.310/2018, art. 38", prazoDias: null,
    descricao: "Certidão de Regularização Fundiária com núcleo, localização, modalidade, responsáveis pelas obras, unidades e listagem de ocupantes.",
    entregas: ["CRF", "Listagem de ocupantes", "Títulos de legitimação"] },
  { codigo: "registro", nome: "Registro no cartório", curto: "Registro", tipo: "legal", baseLegal: "Lei 13.465/2017, arts. 42-54; Dec. 9.310/2018, arts. 40 e 42; Prov. CNJ 149/2023, art. 440-AQ", prazoDias: 60,
    descricao: "Registro da CRF e do projeto, sem exigir quitação de tributos. 15 dias para nota de exigência e 60 dias para concluir. Abertura das matrículas individuais georreferenciadas.",
    entregas: ["Protocolo (SAEC / e-Protocolo)", "Matrículas abertas"] },
];

export const fasePorCodigo = Object.fromEntries(FASES.map((f) => [f.codigo, f])) as Record<CodigoFase, Fase>;

export const TIPOS_PECA: Record<string, { nome: string; baseLegal: string; artRrt: boolean }> = {
  levantamento_planialtimetrico: { nome: "Levantamento planialtimétrico cadastral georreferenciado", baseLegal: "art. 35, I", artRrt: true },
  planta_perimetro: { nome: "Planta do perímetro com matrículas atingidas", baseLegal: "art. 35, II", artRrt: true },
  estudo_preliminar: { nome: "Estudo preliminar das desconformidades", baseLegal: "art. 35, III", artRrt: true },
  projeto_urbanistico: { nome: "Projeto urbanístico", baseLegal: "art. 35, IV; art. 36", artRrt: true },
  memorial_perimetro: { nome: "Memorial descritivo do perímetro", baseLegal: "art. 35, V", artRrt: true },
  memorial_lote: { nome: "Memoriais descritivos das unidades", baseLegal: "art. 35, V", artRrt: true },
  estudo_risco: { nome: "Estudo técnico para situação de risco", baseLegal: "art. 35, VII; art. 39", artRrt: true },
  estudo_ambiental: { nome: "Estudo técnico ambiental", baseLegal: "art. 35, VIII; CF arts. 64-65", artRrt: true },
  cronograma_obras: { nome: "Cronograma físico de obras", baseLegal: "art. 35, IX", artRrt: false },
  termo_compromisso: { nome: "Termo de compromisso", baseLegal: "art. 35, X", artRrt: false },
  edital: { nome: "Edital de notificação", baseLegal: "art. 31, §§4º-5º", artRrt: false },
  cadastro_socioeconomico: { nome: "Cadastro socioeconômico", baseLegal: "art. 13; Dec. 9.310 art. 6º", artRrt: false },
  listagem_ocupantes: { nome: "Listagem de ocupantes", baseLegal: "art. 41, VI", artRrt: false },
  crf: { nome: "Certidão de Regularização Fundiária", baseLegal: "art. 41", artRrt: false },
};

export const SITUACAO_LOTE = {
  levantado: { rotulo: "Levantado", cor: "#a39e92" },
  cadastrado: { rotulo: "Cadastrado", cor: "#5b8db8" },
  notificado: { rotulo: "Notificado", cor: "#2d4f7c" },
  pendencia: { rotulo: "Com pendência", cor: "#c78b1f" },
  apto_crf: { rotulo: "Apto à CRF", cor: "#5f6b3a" },
} as const;
export type SituacaoLote = keyof typeof SITUACAO_LOTE;

export const SITUACAO_PECA: Record<string, { rotulo: string; classe: string }> = {
  rascunho: { rotulo: "Rascunho", classe: "text-tinta-500" },
  em_revisao: { rotulo: "Em revisão", classe: "text-ocre-700" },
  aprovada: { rotulo: "Aprovada", classe: "text-oliva-700" },
  assinada: { rotulo: "Assinada", classe: "text-registro-700" },
  pendente: { rotulo: "Não iniciada", classe: "text-tinta-300" },
};

export const MODALIDADE: Record<string, string> = { reurb_s: "REURB-S", reurb_e: "REURB-E", mista: "Mista" };

export const PAPEL_NOTIFICADO: Record<string, string> = {
  titular_dominio: "Titular de domínio", confrontante: "Confrontante",
  terceiro_interessado: "Terceiros (edital)", ente_publico: "Ente público",
};
export const MEIO_NOTIFICACAO: Record<string, string> = {
  pessoal: "Pessoal", correio_ar: "Correio com AR", edital: "Edital", eletronico: "Eletrônico",
};

export const ESCOLARIDADE: Record<string, string> = {
  sem_instrucao: "Sem instrução", fundamental: "Fundamental", medio: "Médio", superior: "Superior",
};
export const SITUACAO_PROFISSIONAL: Record<string, string> = {
  autonomo: "Autônomo", clt: "Emprego formal", aposentado: "Aposentado/pensionista",
  desempregado: "Desempregado", informal: "Trabalho informal", servidor: "Servidor público",
};
export const TIPO_DOCUMENTO: Record<string, string> = {
  rg: "Documento de identidade", cpf: "CPF", certidao_casamento: "Certidão de casamento / união estável",
  comprovante_renda: "Comprovante de renda", comprovante_residencia: "Comprovante de residência",
  declaracao_nao_proprietario: "Declaração de não possuir outro imóvel", foto_fachada: "Foto da fachada",
  requerimento: "Requerimento", ato_classificacao: "Ato de classificação", decreto: "Decreto", portaria: "Portaria",
  oficio: "Ofício", despacho: "Despacho", ata: "Ata", publicacao_edital: "Publicação de edital",
  peca_emitida: "Peça técnica emitida", ar_correios: "Aviso de recebimento", outro: "Outro",
};
export const METODO_ASSINATURA: Record<string, string> = {
  icp_brasil: "Certificado ICP-Brasil", gov_br_avancada: "gov.br (avançada)", gov_br_qualificada: "gov.br (qualificada)", eletronica_simples: "Eletrônica simples",
};

export const SALARIO_MINIMO = 1518;
export const LIMITE_ERRO_ESFERICO_M = 0.08; // Dec. 9.310/2018, art. 29, §3º

export const fmt = {
  num: (v: number, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }),
  int: (v: number) => v.toLocaleString("pt-BR"),
  moeda: (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  data: (iso: string | null | undefined) => (iso ? new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR") : "—"),
  dataCurta: (iso: string | null | undefined) => (iso ? new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"),
  gms: (graus: number) => {
    const total = Math.round(graus * 3600);
    const g = Math.floor(total / 3600) % 360;
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${g}°${String(m).padStart(2, "0")}'${String(s).padStart(2, "0")}"`;
  },
  kb: (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`),
};

export function erroEsferico(sigma: number) {
  // sigma_e = sigma_n = sigma; sigma_h = 1,6·sigma (convenção do gerador de demonstração)
  return Math.sqrt(sigma ** 2 * 2 + (1.6 * sigma) ** 2);
}
