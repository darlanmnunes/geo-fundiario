import { Cabecalho, Carimbo, Painel } from "@/components/ui";
import { FASES } from "@/lib/dominio";

export const metadata = { title: "Base legal e normas" };

const NORMAS = [
  { grupo: "Leis e decretos", itens: [
    ["Lei 13.465/2017", "Marco da REURB: modalidades, legitimados, fases (art. 28), projeto (arts. 35-39), CRF (art. 41) e registro (arts. 42-54)."],
    ["Decreto 9.310/2018", "Regulamento: renda de até 5 SM (art. 6º), precisão ≤ 8 cm por vértice (art. 29, §3º), prazos de registro (arts. 40 e 42)."],
    ["Lei 6.015/1973", "Registros Públicos: retificação (art. 213), matrícula de áreas públicas (art. 195-A), aquisição originária (art. 176-A)."],
    ["Lei 12.651/2012", "Código Florestal: REURB-S em APP (art. 64) e REURB-E em APP (art. 65, faixa não edificável de 15 m)."],
    ["Lei 14.382/2022", "SERP: registro eletrônico, extratos e matrícula eletrônica."],
    ["Lei 10.257/2001", "Estatuto da Cidade: ZEIS, usucapião especial e demais instrumentos."],
  ] },
  { grupo: "Foro extrajudicial", itens: [
    ["Provimento CNJ 149/2023", "Código Nacional de Normas: matrícula com descrição georreferenciada obrigatória na REURB (art. 440-AQ) e lançamento no SIG-RI por profissional credenciado no ONR (arts. 343-G e 343-H)."],
    ["ONR / SAEC", "e-Protocolo e, desde 07/2026, módulo de acompanhamento de REURB com importação de dados em JSON."],
  ] },
  { grupo: "Normas técnicas", itens: [
    ["ABNT NBR 13133:2021", "Execução de levantamento topográfico."],
    ["ABNT NBR 17047:2022", "Levantamento cadastral territorial para registro público."],
    ["ABNT NBR 14166:2023", "Rede de Referência Cadastral Municipal."],
    ["Portaria MDR 3.242/2022", "Diretrizes do Cadastro Territorial Multifinalitário (CTM)."],
    ["ISO 19152-1:2024", "LADM, modelo conceitual do domínio de administração territorial. É a base do banco deste sistema."],
  ] },
];

export default function Legislacao() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6">
      <Cabecalho
        sobretitulo="Base de conhecimento"
        titulo="Fluxo legal da REURB e normas aplicáveis"
        descricao="Cada fase do sistema corresponde a uma etapa da Lei 13.465/2017 ou a uma etapa técnica de apoio. O detalhamento com fontes está em docs/marco-legal-e-fluxo-reurb.md no repositório."
      />
      <div className="mt-7 grid gap-5 xl:grid-cols-5">
        <Painel className="xl:col-span-3" titulo="Fases do processo" corpo="p-0">
          <ol className="divide-y divide-[color:var(--linha)]">
            {FASES.map((f, i) => (
              <li key={f.codigo} className="grid grid-cols-[40px_1fr] gap-3 px-4 py-3">
                <span className="serif tab text-[22px] leading-none text-tinta-300">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-medium text-tinta-900">{f.nome}</p>
                    {f.prazoDias && <Carimbo tom="ocre">{f.prazoDias} dias</Carimbo>}
                    {f.tipo === "tecnica" && <Carimbo>técnica</Carimbo>}
                  </div>
                  {f.baseLegal && <p className="mono mt-0.5 text-[11px] text-tinta-500">{f.baseLegal}</p>}
                  <p className="mt-1 text-[13px] leading-relaxed text-tinta-700">{f.descricao}</p>
                </div>
              </li>
            ))}
          </ol>
        </Painel>
        <div className="space-y-5 xl:col-span-2">
          {NORMAS.map((g) => (
            <Painel key={g.grupo} titulo={g.grupo}>
              <dl className="space-y-3 text-[13px]">
                {g.itens.map(([n, d]) => (
                  <div key={n}><dt className="font-medium text-tinta-900">{n}</dt><dd className="leading-relaxed text-tinta-700">{d}</dd></div>
                ))}
              </dl>
            </Painel>
          ))}
        </div>
      </div>
    </div>
  );
}
