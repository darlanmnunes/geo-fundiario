// Inteligência territorial — dossiê de uma área a partir de camadas públicas.
// Protótipo com achados SIMULADOS. Em produção cada camada vem de uma fonte real
// (IBGE, ANA, SGB/CPRM, CAR/SICAR, SIGEF/INCRA, ICMBio/FUNAI, cadastro municipal, CRI).

export type Severidade = "impede" | "condiciona" | "atencao" | "ok" | "sem_dado";

export interface Achado {
  camada: string;
  fonte: string;
  resultado: string;
  severidade: Severidade;
  implicacao: string;
  base?: string;
}

export interface Dossie {
  projetoId: number;
  resumo: string;
  pontuacao: number; // 0–100: aptidão para prosseguir sem intervenção extra (simulada)
  achados: Achado[];
}

export const SEVERIDADE: Record<Severidade, { rotulo: string; tom: "carimbo" | "ocre" | "registro" | "oliva" | "neutro"; peso: number }> = {
  impede: { rotulo: "impede", tom: "carimbo", peso: 35 },
  condiciona: { rotulo: "condiciona", tom: "ocre", peso: 15 },
  atencao: { rotulo: "atenção", tom: "registro", peso: 6 },
  ok: { rotulo: "sem restrição", tom: "oliva", peso: 0 },
  sem_dado: { rotulo: "sem dado", tom: "neutro", peso: 3 },
};

export const CAMADAS = [
  { nome: "Marco temporal (ocupação até 22/12/2016)", fonte: "Imagens históricas (Landsat/Sentinel, ortofotos municipais)", base: "Lei 13.465/2017, art. 9º, §2º" },
  { nome: "Hidrografia e APP", fonte: "ANA (BHO), IBGE, IDE municipal", base: "Lei 12.651/2012, arts. 4º, 64 e 65" },
  { nome: "Risco geológico e hidrológico", fonte: "SGB/CPRM (setorização de risco), CEMADEN, Defesa Civil", base: "Lei 13.465/2017, art. 39" },
  { nome: "Declividade", fonte: "MDE (Copernicus 30 m / SRTM) ou levantamento próprio", base: "Lei 6.766/1979, art. 3º, III" },
  { nome: "Setor censitário", fonte: "IBGE, Censo 2022 (agregados por setor)", base: "Dec. 9.310/2018, art. 6º (renda)" },
  { nome: "Zoneamento e ZEIS", fonte: "Plano Diretor e lei de uso do solo do município", base: "Lei 10.257/2001, art. 4º" },
  { nome: "Matrículas atingidas", fonte: "Registro de Imóveis (SIG-RI / ONR)", base: "Lei 13.465/2017, art. 31; art. 35, II" },
  { nome: "Cadastro Ambiental Rural", fonte: "SICAR", base: "Lei 12.651/2012, art. 29" },
  { nome: "Imóveis rurais certificados", fonte: "SIGEF / INCRA", base: "Lei 6.015/1973, art. 176, §3º" },
  { nome: "Unidades de conservação e terras indígenas", fonte: "ICMBio, FUNAI, órgão estadual", base: "Lei 9.985/2000" },
  { nome: "Infraestrutura essencial", fonte: "Concessionárias, SNIS, cadastro municipal", base: "Lei 13.465/2017, art. 36, §1º" },
  { nome: "Bens tombados e sítios arqueológicos", fonte: "IPHAN (CNSA), órgão estadual", base: "Dec.-Lei 25/1937" },
];

const dossies: Dossie[] = [
  {
    projetoId: 1,
    resumo: "Núcleo consolidado antes do marco temporal, em área urbana. Faixa marginal do córrego a leste exige estudo técnico ambiental; duas matrículas-mãe atingidas; infraestrutura parcial.",
    pontuacao: 0,
    achados: [
      { camada: CAMADAS[0].nome, fonte: CAMADAS[0].fonte, resultado: "Ocupação visível em imagem de 06/2014 em 92% dos lotes atuais.", severidade: "ok", implicacao: "Atende ao marco temporal.", base: CAMADAS[0].base },
      { camada: CAMADAS[1].nome, fonte: CAMADAS[1].fonte, resultado: "Curso d'água de 2 m de largura a 11–28 m da divisa leste de 6 lotes.", severidade: "condiciona", implicacao: "Faixa não edificável de 15 m (REURB-E) ou estudo técnico com melhoria ambiental (REURB-S, art. 64).", base: CAMADAS[1].base },
      { camada: CAMADAS[2].nome, fonte: CAMADAS[2].fonte, resultado: "Fora de setor de risco mapeado; alagamento pontual relatado em 2022.", severidade: "atencao", implicacao: "Registrar no estudo preliminar; verificar drenagem no projeto urbanístico.", base: CAMADAS[2].base },
      { camada: CAMADAS[3].nome, fonte: CAMADAS[3].fonte, resultado: "Declividade média 7%, máxima 19%.", severidade: "ok", implicacao: "Abaixo de 30%; sem exigência especial." },
      { camada: CAMADAS[4].nome, fonte: CAMADAS[4].fonte, resultado: "Setor 317130305000031: renda domiciliar mediana 1,9 SM; 212 domicílios.", severidade: "ok", implicacao: "Coerente com a classificação REURB-S.", base: CAMADAS[4].base },
      { camada: CAMADAS[5].nome, fonte: CAMADAS[5].fonte, resultado: "ZEIS-2 (lei municipal de uso do solo).", severidade: "ok", implicacao: "Zona compatível; parâmetros urbanísticos especiais aplicáveis." },
      { camada: CAMADAS[6].nome, fonte: CAMADAS[6].fonte, resultado: "2 matrículas atingidas (uma com espólio; uma pessoa jurídica).", severidade: "condiciona", implicacao: "Notificar titulares (art. 31); espólio exige inventariante ou edital.", base: CAMADAS[6].base },
      { camada: CAMADAS[7].nome, fonte: CAMADAS[7].fonte, resultado: "Sem CAR sobreposto.", severidade: "ok", implicacao: "—" },
      { camada: CAMADAS[8].nome, fonte: CAMADAS[8].fonte, resultado: "Sem parcela SIGEF sobreposta.", severidade: "ok", implicacao: "—" },
      { camada: CAMADAS[9].nome, fonte: CAMADAS[9].fonte, resultado: "Fora de UC, zona de amortecimento e TI.", severidade: "ok", implicacao: "—" },
      { camada: CAMADAS[10].nome, fonte: CAMADAS[10].fonte, resultado: "Água e energia em 100% dos lotes; esgoto em 61%; sem drenagem.", severidade: "condiciona", implicacao: "Cronograma de obras e termo de compromisso (art. 35, IX-X).", base: CAMADAS[10].base },
      { camada: CAMADAS[11].nome, fonte: CAMADAS[11].fonte, resultado: "Sem bem tombado ou sítio cadastrado num raio de 500 m.", severidade: "ok", implicacao: "—" },
    ],
  },
  {
    projetoId: 2,
    resumo: "Loteamento de renda média com infraestrutura quase completa. Parte do perímetro em área que o cadastro ainda trata como rural: precisa de desafetação e checagem no SIGEF antes do registro.",
    pontuacao: 0,
    achados: [
      { camada: CAMADAS[0].nome, fonte: CAMADAS[0].fonte, resultado: "Ocupação em 100% dos lotes em imagem de 09/2016.", severidade: "ok", implicacao: "Atende ao marco temporal.", base: CAMADAS[0].base },
      { camada: CAMADAS[1].nome, fonte: CAMADAS[1].fonte, resultado: "Sem curso d'água ou nascente em 100 m.", severidade: "ok", implicacao: "—" },
      { camada: CAMADAS[2].nome, fonte: CAMADAS[2].fonte, resultado: "Sem setor de risco.", severidade: "ok", implicacao: "—" },
      { camada: CAMADAS[3].nome, fonte: CAMADAS[3].fonte, resultado: "Declividade média 12%, máxima 27%.", severidade: "atencao", implicacao: "Verificar contenções nos lotes de maior declive." },
      { camada: CAMADAS[4].nome, fonte: CAMADAS[4].fonte, resultado: "Setor 317130305000044: renda mediana 7,4 SM.", severidade: "ok", implicacao: "Coerente com REURB-E.", base: CAMADAS[4].base },
      { camada: CAMADAS[5].nome, fonte: CAMADAS[5].fonte, resultado: "Zona de expansão urbana; 30% do perímetro fora do perímetro urbano legal.", severidade: "condiciona", implicacao: "Lei municipal de inclusão no perímetro urbano antes da aprovação.", base: CAMADAS[5].base },
      { camada: CAMADAS[6].nome, fonte: CAMADAS[6].fonte, resultado: "1 matrícula-mãe (loteador identificado).", severidade: "ok", implicacao: "Notificação simples." },
      { camada: CAMADAS[7].nome, fonte: CAMADAS[7].fonte, resultado: "CAR ativo sobre a gleba de origem (imóvel rural).", severidade: "condiciona", implicacao: "Retificar ou cancelar o CAR da parte urbanizada.", base: CAMADAS[7].base },
      { camada: CAMADAS[8].nome, fonte: CAMADAS[8].fonte, resultado: "Parcela SIGEF certificada sobreposta em 1,2 ha.", severidade: "impede", implicacao: "Registro barrado até desmembramento e atualização no INCRA (art. 44).", base: CAMADAS[8].base },
      { camada: CAMADAS[9].nome, fonte: CAMADAS[9].fonte, resultado: "Fora de UC e TI.", severidade: "ok", implicacao: "—" },
      { camada: CAMADAS[10].nome, fonte: CAMADAS[10].fonte, resultado: "Água, energia e drenagem completas; esgoto por fossa.", severidade: "atencao", implicacao: "Solução de esgotamento no projeto urbanístico.", base: CAMADAS[10].base },
      { camada: CAMADAS[11].nome, fonte: CAMADAS[11].fonte, resultado: "Sem dado disponível para a área.", severidade: "sem_dado", implicacao: "Consultar IPHAN antes da aprovação." },
    ],
  },
];

export function obterDossie(projetoId: number): Dossie | undefined {
  const d = dossies.find((x) => x.projetoId === projetoId);
  if (!d) return undefined;
  const penalidade = d.achados.reduce((s, a) => s + SEVERIDADE[a.severidade].peso, 0);
  return { ...d, pontuacao: Math.max(0, 100 - penalidade) };
}

export function listarDossies() {
  return dossies.map((d) => obterDossie(d.projetoId)!);
}
