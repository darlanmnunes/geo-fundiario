// Vocabulário do domínio REURB — espelha os catálogos do banco (db/migrations/003, 006 e 008).

/** Leis, decretos e normas citados no sistema, com o endereço do texto oficial ou da ficha da norma. */
export const NORMAS = {
  lei13465: { rotulo: "Lei 13.465/2017", grupo: "Leis e decretos", url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/lei/l13465.htm",
    resumo: "Marco da REURB: modalidades, legitimados, fases (art. 28), projeto (arts. 35-39), CRF (art. 41) e registro (arts. 42-54)." },
  dec9310: { rotulo: "Decreto 9.310/2018", grupo: "Leis e decretos", url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9310.htm",
    resumo: "Regulamento: renda de até 5 salários mínimos (art. 6º), precisão de 8 cm por vértice (art. 29, §3º), prazos de registro (arts. 40 e 42)." },
  lei6015: { rotulo: "Lei 6.015/1973", grupo: "Leis e decretos", url: "https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm",
    resumo: "Registros Públicos: retificação (art. 213), matrícula de áreas públicas (art. 195-A), aquisição originária (art. 176-A)." },
  lei12651: { rotulo: "Lei 12.651/2012", grupo: "Leis e decretos", url: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12651.htm",
    resumo: "Código Florestal: REURB-S em APP (art. 64) e REURB-E em APP (art. 65, faixa não edificável de 15 m)." },
  lei6766: { rotulo: "Lei 6.766/1979", grupo: "Leis e decretos", url: "https://www.planalto.gov.br/ccivil_03/leis/l6766.htm",
    resumo: "Parcelamento do solo urbano: vedações em terrenos alagadiços, aterrados ou com declividade de 30% ou mais (art. 3º)." },
  lei10257: { rotulo: "Lei 10.257/2001", grupo: "Leis e decretos", url: "https://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10257.htm",
    resumo: "Estatuto da Cidade: ZEIS, usucapião especial e demais instrumentos." },
  lei14382: { rotulo: "Lei 14.382/2022", grupo: "Leis e decretos", url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14382.htm",
    resumo: "SERP: registro eletrônico, extratos e matrícula eletrônica." },
  lei9985: { rotulo: "Lei 9.985/2000", grupo: "Leis e decretos", url: "https://www.planalto.gov.br/ccivil_03/leis/l9985.htm",
    resumo: "Sistema Nacional de Unidades de Conservação (SNUC)." },
  lei10267: { rotulo: "Lei 10.267/2001", grupo: "Leis e decretos", url: "https://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10267.htm",
    resumo: "Georreferenciamento de imóveis rurais ao Sistema Geodésico Brasileiro." },
  declei25: { rotulo: "Decreto-Lei 25/1937", grupo: "Leis e decretos", url: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del0025.htm",
    resumo: "Proteção do patrimônio histórico e artístico nacional." },
  prov149: { rotulo: "Provimento CNJ 149/2023", grupo: "Foro extrajudicial", url: "https://atos.cnj.jus.br/files/compilado200716202607176a5a8b7462061.pdf",
    resumo: "Código Nacional de Normas: matrícula com descrição georreferenciada obrigatória na REURB (art. 440-AQ) e lançamento no SIG-RI por profissional credenciado no ONR." },
  onr: { rotulo: "ONR / SAEC", grupo: "Foro extrajudicial", url: "https://www.registrodeimoveis.org.br/onr-disponibiliza-modulo-para-acompanhamento-de-reurb",
    resumo: "e-Protocolo e módulo de acompanhamento de REURB do Operador Nacional do Registro." },
  nbr13133: { rotulo: "ABNT NBR 13133:2021", grupo: "Normas técnicas", url: "https://www.target.com.br/produtos/normas-tecnicas/27635/nbr13133-execucao-de-levantamento-topografico-procedimento",
    resumo: "Execução de levantamento topográfico." },
  nbr17047: { rotulo: "ABNT NBR 17047:2022", grupo: "Normas técnicas", url: "https://www.normas.com.br/visualizar/abnt-nbr-nm/13419/abnt-nbr17047-levantamento-cadastral-territorial-para-registro-publico-procedimento",
    resumo: "Levantamento cadastral territorial para registro público." },
  nbr14166: { rotulo: "ABNT NBR 14166", grupo: "Normas técnicas", url: "https://normas.com.br/visualizar/abnt-nbr-nm/10905/abnt-nbr14166-rede-de-referencia-cadastral-municipal-requisitos-e-procedimento",
    resumo: "Rede de Referência Cadastral Municipal." },
  portaria3242: { rotulo: "Portaria MDR 3.242/2022", grupo: "Normas técnicas", url: "https://www.irib.org.br/noticias/detalhes/portaria-mdr-n-3-242-de-9-de-novembro-de-2022",
    resumo: "Diretrizes do Cadastro Territorial Multifinalitário (CTM)." },
  iso19152: { rotulo: "ISO 19152-1:2024", grupo: "Normas técnicas", url: "https://www.iso.org/standard/81263.html",
    resumo: "LADM, modelo conceitual do domínio de administração territorial. É a base do banco deste sistema." },
} as const;
export type CodigoNorma = keyof typeof NORMAS;
export interface Referencia { norma: CodigoNorma; trecho?: string }

export type CodigoFase =
  | "diagnostico" | "requerimento" | "classificacao" | "levantamento" | "notificacao"
  | "projeto" | "saneamento" | "aprovacao" | "crf" | "registro";

export interface Fase {
  codigo: CodigoFase;
  nome: string;
  curto: string;
  tipo: "legal" | "tecnica";
  base: Referencia[];
  prazoDias: number | null;
  prazoNota?: string;
  descricao: string;
  entregas: string[];
  quem: string;
}

export const FASES: Fase[] = [
  { codigo: "diagnostico", nome: "Diagnóstico e planejamento", curto: "Diagnóstico", tipo: "tecnica", base: [{ norma: "lei13465", trecho: "art. 9º, §2º" }], prazoDias: null,
    descricao: "Delimitação preliminar do núcleo, verificação do marco temporal (22/12/2016), bases cartográficas e plano de campo.",
    entregas: ["Poligonal preliminar", "Bases cartográficas e ortofoto", "Plano de trabalho"], quem: "Equipe técnica" },
  { codigo: "requerimento", nome: "Requerimento e instauração", curto: "Requerimento", tipo: "legal", base: [{ norma: "lei13465", trecho: "art. 14; art. 28, I; art. 32" }], prazoDias: null,
    descricao: "Requerimento do legitimado e instauração do processo administrativo pelo Município.",
    entregas: ["Requerimento", "Delimitação preliminar", "Ato de instauração"], quem: "Legitimado e Município" },
  { codigo: "classificacao", nome: "Classificação da modalidade", curto: "Classificação", tipo: "legal", base: [{ norma: "lei13465", trecho: "art. 13; art. 30, §§2º-3º" }, { norma: "dec9310", trecho: "arts. 5º, 6º e 23" }], prazoDias: 180,
    prazoNota: "Sem decisão no prazo, vale a modalidade indicada pelo requerente.",
    descricao: "REURB-S (baixa renda, até 5 salários mínimos) ou REURB-E. Sem decisão em 180 dias, vale a modalidade indicada pelo requerente.",
    entregas: ["Ato de classificação", "Cadastro socioeconômico amostral"], quem: "Município" },
  { codigo: "levantamento", nome: "Levantamento de campo", curto: "Levantamento", tipo: "tecnica", base: [{ norma: "lei13465", trecho: "art. 35, I" }, { norma: "dec9310", trecho: "arts. 28-29" }, { norma: "nbr13133" }, { norma: "nbr17047" }], prazoDias: null,
    descricao: "Planialtimétrico cadastral georreferenciado ao SGB (SIRGAS 2000), erro posicional de até 8 cm por vértice, e cadastro socioeconômico imóvel a imóvel.",
    entregas: ["Vértices com precisão", "Lotes, quadras e edificações", "Cadastro social", "ART/RRT"], quem: "Responsável técnico e equipe de campo" },
  { codigo: "notificacao", nome: "Buscas e notificações", curto: "Notificações", tipo: "legal", base: [{ norma: "lei13465", trecho: "art. 31" }, { norma: "dec9310", trecho: "art. 24" }], prazoDias: 30,
    prazoNota: "Contado do recebimento; o silêncio vale como concordância.",
    descricao: "Buscas nas matrículas atingidas e notificação de titulares, confrontantes e terceiros, por AR ou edital. 30 dias para impugnar; silêncio vale como concordância.",
    entregas: ["Certidões das matrículas", "Notificações e ARs", "Edital"], quem: "Município e Registro de Imóveis" },
  { codigo: "projeto", nome: "Projeto de regularização", curto: "Projeto", tipo: "legal", base: [{ norma: "lei13465", trecho: "arts. 35-39" }, { norma: "dec9310", trecho: "arts. 30-32" }, { norma: "lei12651", trecho: "arts. 64-65" }], prazoDias: null,
    descricao: "Plantas, memoriais, projeto urbanístico, estudos técnicos ambiental e de risco, cronograma de obras e termo de compromisso.",
    entregas: ["Planta do perímetro", "Memoriais descritivos", "Projeto urbanístico", "Estudos técnicos", "Cronograma"], quem: "Responsável técnico" },
  { codigo: "saneamento", nome: "Saneamento e impugnações", curto: "Saneamento", tipo: "legal", base: [{ norma: "lei13465", trecho: "art. 28, IV; arts. 21, 31 §3º e 34" }, { norma: "dec9310", trecho: "art. 24, §§10-12" }], prazoDias: null,
    prazoNota: "Recurso contra rejeição de impugnação: 15 dias.",
    descricao: "Análise das impugnações, mediação e câmaras de prevenção e resolução de conflitos. Recurso em 15 dias.",
    entregas: ["Pareceres", "Acordos", "Termo de compromisso"], quem: "Município (jurídico)" },
  { codigo: "aprovacao", nome: "Decisão e aprovação", curto: "Aprovação", tipo: "legal", base: [{ norma: "lei13465", trecho: "art. 28, V; art. 40" }], prazoDias: null,
    descricao: "Ato formal da autoridade competente que aprova o projeto, indica as intervenções e identifica os ocupantes.",
    entregas: ["Decreto ou portaria de aprovação", "Publicação"], quem: "Autoridade municipal" },
  { codigo: "crf", nome: "Emissão da CRF", curto: "CRF", tipo: "legal", base: [{ norma: "lei13465", trecho: "art. 28, VI; art. 41" }, { norma: "dec9310", trecho: "art. 38" }], prazoDias: null,
    descricao: "Certidão de Regularização Fundiária com núcleo, localização, modalidade, responsáveis pelas obras, unidades e listagem de ocupantes.",
    entregas: ["CRF", "Listagem de ocupantes", "Títulos de legitimação"], quem: "Município" },
  { codigo: "registro", nome: "Registro no cartório", curto: "Registro", tipo: "legal", base: [{ norma: "lei13465", trecho: "arts. 42-54" }, { norma: "dec9310", trecho: "arts. 40 e 42" }, { norma: "prov149", trecho: "art. 440-AQ" }], prazoDias: 60,
    prazoNota: "15 dias para nota de exigência e 60 dias para concluir o registro.",
    descricao: "Registro da CRF e do projeto, sem exigir quitação de tributos. Abertura das matrículas individuais georreferenciadas.",
    entregas: ["Protocolo (SAEC / e-Protocolo)", "Matrículas abertas"], quem: "Registro de Imóveis" },
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
  estudo_ambiental: { nome: "Estudo técnico ambiental", baseLegal: "art. 35, VIII", artRrt: true },
  cronograma_obras: { nome: "Cronograma físico de obras", baseLegal: "art. 35, IX", artRrt: false },
  termo_compromisso: { nome: "Termo de compromisso", baseLegal: "art. 35, X", artRrt: false },
  edital: { nome: "Edital de notificação", baseLegal: "art. 31, §§4º-5º", artRrt: false },
  cadastro_socioeconomico: { nome: "Cadastro socioeconômico", baseLegal: "art. 13", artRrt: false },
  listagem_ocupantes: { nome: "Listagem de ocupantes", baseLegal: "art. 41, VI", artRrt: false },
  crf: { nome: "Certidão de Regularização Fundiária", baseLegal: "art. 41", artRrt: false },
};

// Cores das situações: categóricas, distinguíveis entre si também para daltonismo (matiz + claridade).
export const SITUACAO_LOTE = {
  levantado: { rotulo: "Levantado", cor: "#8c97a6", descricao: "Limites medidos; sem cadastro social" },
  cadastrado: { rotulo: "Cadastrado", cor: "#2f7de1", descricao: "Cadastro socioeconômico concluído" },
  notificado: { rotulo: "Notificado", cor: "#7a4fc4", descricao: "Titulares e confrontantes notificados" },
  pendencia: { rotulo: "Com pendência", cor: "#e2780c", descricao: "Há pendência em aberto" },
  apto_crf: { rotulo: "Apto à CRF", cor: "#1c8a2c", descricao: "Sem pendências; pode constar da CRF" },
} as const;
export type SituacaoLote = keyof typeof SITUACAO_LOTE;
export const SITUACOES = Object.keys(SITUACAO_LOTE) as SituacaoLote[];

export type Tom = "neutro" | "azul" | "verde" | "ambar" | "vermelho" | "roxo";

export const SITUACAO_PECA: Record<string, { rotulo: string; tom: Tom }> = {
  rascunho: { rotulo: "Rascunho", tom: "neutro" },
  em_revisao: { rotulo: "Em revisão", tom: "ambar" },
  aprovada: { rotulo: "Aprovada", tom: "verde" },
  assinada: { rotulo: "Assinada", tom: "azul" },
  pendente: { rotulo: "Não iniciada", tom: "neutro" },
};

export const MODALIDADE: Record<string, string> = { reurb_s: "REURB-S", reurb_e: "REURB-E", mista: "Mista" };
export const MODALIDADE_LONGA: Record<string, string> = { reurb_s: "Interesse social", reurb_e: "Interesse específico", mista: "Mista" };

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
  clt: "Emprego formal", autonomo: "Autônomo", informal: "Trabalho informal", aposentado: "Aposentado ou pensionista",
  servidor: "Servidor público", desempregado: "Desempregado",
};
export const FAIXA_RENDA: Record<string, string> = { ate_1: "Até 1 SM", "1_2": "1 a 2 SM", "2_3": "2 a 3 SM", "3_5": "3 a 5 SM", acima_5: "Acima de 5 SM" };
export const FAIXA_IDADE: Record<string, string> = { ate_29: "Até 29 anos", "30_44": "30 a 44", "45_59": "45 a 59", "60_mais": "60 ou mais" };

export const TIPO_DOCUMENTO: Record<string, string> = {
  rg: "Documento de identidade", cpf: "CPF", certidao_casamento: "Certidão de casamento ou união estável",
  comprovante_renda: "Comprovante de renda", comprovante_residencia: "Comprovante de residência",
  declaracao_nao_proprietario: "Declaração de não possuir outro imóvel", foto_fachada: "Foto da fachada",
  requerimento: "Requerimento", ato_classificacao: "Ato de classificação", decreto: "Decreto", portaria: "Portaria",
  oficio: "Ofício", despacho: "Despacho", ata: "Ata", publicacao_edital: "Publicação de edital",
  peca_emitida: "Peça técnica emitida", ar_correios: "Aviso de recebimento", outro: "Outro",
};
export const METODO_ASSINATURA: Record<string, string> = {
  icp_brasil: "Certificado ICP-Brasil", gov_br_avancada: "gov.br (avançada)", gov_br_qualificada: "gov.br (qualificada)", eletronica_simples: "Eletrônica simples",
};
export const METODO_MEDICAO: Record<string, string> = { gnss_rtk: "GNSS RTK", gnss_ppp: "GNSS pós-processado", estacao_total: "Estação total" };

export const SALARIO_MINIMO = 1518;

/** Norma de precisão posicional aplicada ao projeto (vem do banco: ladm.cl_norma_precisao). */
export interface NormaPrecisao { code: string; descricao: string; base_legal: string; componente: "tridimensional" | "planimetrica"; aplicacao: string; tolerancia_m: number }

type Sigmas = { sigma_e: number; sigma_n: number; sigma_h: number };
/** Erro posicional tridimensional (1σ): resultante dos desvios-padrão em E, N e h. */
export const erroPosicional = (v: Sigmas) => Math.hypot(v.sigma_e, v.sigma_n, v.sigma_h);
/** Resultante planimétrica (E, N). */
export const erroPlanimetrico = (v: { sigma_e: number; sigma_n: number }) => Math.hypot(v.sigma_e, v.sigma_n);
/** O erro que a norma do projeto manda comparar com a tolerância. */
export const erroDaNorma = (v: Sigmas, n: NormaPrecisao) => (n.componente === "tridimensional" ? erroPosicional(v) : erroPlanimetrico(v));
export const rotuloComponente = (n: NormaPrecisao) => (n.componente === "tridimensional" ? "tridimensional" : "planimétrico");
/** Tolerância escrita na unidade que se lê melhor: cm abaixo de 1 m. */
export const fmtTolerancia = (m: number) => (m < 1 ? `${(m * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} cm` : `${m.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m`);

/** Acha, num texto de base legal, a primeira norma cadastrada (para virar link). */
export function normaCitada(texto: string | null | undefined) {
  if (!texto) return null;
  const t = texto.replace("Dec.-Lei", "Decreto-Lei").replace("Dec. 9.310", "Decreto 9.310");
  return Object.values(NORMAS).find((n) => t.includes(n.rotulo)) ?? null;
}

export const fmt = {
  num: (v: number, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }),
  int: (v: number) => v.toLocaleString("pt-BR"),
  pct: (parte: number, total: number) => (total ? `${Math.round((parte / total) * 100)}%` : "0%"),
  moeda: (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  data: (iso: string | null | undefined) => (iso ? new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR") : "sem data"),
  dataCurta: (iso: string | null | undefined) => (iso ? new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : ""),
  gms: (graus: number, sinal = false) => {
    const total = Math.round(Math.abs(graus) * 3600);
    const g = Math.floor(total / 3600) % 360;
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${sinal && graus < 0 ? "-" : ""}${g}°${String(m).padStart(2, "0")}'${String(s).padStart(2, "0")}"`;
  },
  kb: (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1).replace(".", ",")} MB` : `${kb} KB`),
  ha: (m2: number) => `${(m2 / 10_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`,
};

export const REPOSITORIO = "https://github.com/darlanmnunes/geo-fundiario";
/** Endereço do site do GPGeoIA. Enquanto for null, o logotipo no rodapé aparece sem link. */
// Espelho do grupo no Diretório dos Grupos de Pesquisa do CNPq, enquanto o grupo não tem site próprio.
export const SITE_GRUPO: string | null = "http://dgp.cnpq.br/dgp/espelhogrupo/833723";
