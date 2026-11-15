import { FiguraAssistente } from "@/components/ilustracoes";
import { Aviso, Cabecalho, Etiqueta, Pagina, Painel, classeBotao } from "@/components/ui";

export const metadata = { title: "Assistente IA" };

const EXEMPLOS = [
  "Quantas unidades estão aptas à CRF em cada núcleo?",
  "Quais núcleos têm prazo legal vencendo nos próximos 30 dias?",
  "Qual a distribuição de renda das famílias do Núcleo Vila Esperança?",
  "Quantos vértices estão acima da tolerância, por método de medição?",
  "Que achados territoriais impedem o registro, e em quais núcleos?",
];

const VISOES = [
  ["nucleo", "um registro por núcleo: modalidade, fase atual, unidades, famílias, área"],
  ["unidade", "situação, área, pendências em aberto, faixa de renda e composição familiar, sem nome nem CPF"],
  ["fase", "as dez fases de cada núcleo, com datas e prazos"],
  ["pendencia", "origem e base legal de cada pendência, sem o texto livre"],
  ["qualidade_vertice", "erro posicional de cada vértice, a tolerância da norma e se atende"],
  ["notificacao", "papel, meio, datas e resposta, sem o nome do notificado"],
  ["peca", "situação de cada peça técnica"],
  ["achado_territorial", "achados da inteligência territorial, com severidade"],
];

export default function Assistente() {
  return (
    <Pagina>
      <Cabecalho
        titulo="Assistente IA"
        descricao="Perguntas ao banco em português, para quem precisa de um número sem montar um relatório. A base de segurança já está no banco; o serviço de linguagem está em fase de teste."
        acoes={<Etiqueta tom="ambar">Em preparação</Etiqueta>}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Painel titulo="Faça uma pergunta">
          <form className="flex gap-2" aria-describedby="nota-assistente">
            <label className="sr-only" htmlFor="pergunta">Pergunta</label>
            <input id="pergunta" disabled placeholder="Ex.: quantas unidades estão aptas à CRF?" className="h-9 min-w-0 flex-1 rounded border border-borda-forte bg-realce px-3 text-[14px] placeholder:text-texto-3 disabled:cursor-not-allowed" />
            <button type="submit" disabled className={classeBotao("primario", "h-9")}>Perguntar</button>
          </form>
          <p id="nota-assistente" className="mt-2 text-[13px] text-texto-3">O campo será liberado quando o serviço de linguagem for ligado a este servidor.</p>

          <h3 className="mt-5 text-[13px] font-semibold">Perguntas que ele vai responder</h3>
          <ul className="mt-1.5 divide-y divide-borda rounded border border-borda">
            {EXEMPLOS.map((e) => <li key={e} className="px-3 py-2 text-[14px] text-texto-2">{e}</li>)}
          </ul>
        </Painel>

        <Painel titulo="O que ele pode consultar">
          <p className="text-[13.5px] leading-relaxed text-texto-2">
            Só as visões do esquema <span className="cod">consulta</span> do banco, feitas sem nome, CPF, contato ou documento de ninguém:
          </p>
          <dl className="mt-2 space-y-1.5 text-[13.5px]">
            {VISOES.map(([v, d]) => <div key={v} className="grid grid-cols-[9.5rem_1fr] gap-2"><dt className="cod text-texto">{v}</dt><dd className="text-texto-2">{d}</dd></div>)}
          </dl>
        </Painel>
      </div>

      <Painel className="mt-4" titulo="Como vai funcionar">
        <FiguraAssistente />
        <div className="mt-3 grid gap-x-8 gap-y-2 text-[13.5px] leading-relaxed text-texto-2 md:grid-cols-2">
          <p>O modelo de linguagem não recebe os dados: recebe a pergunta e a descrição das visões, e devolve um comando de leitura. Quem lê o banco é o servidor.</p>
          <p>Antes de rodar, o comando é validado e executado com um papel do banco que só lê o esquema de consulta, com limite de 5 segundos e de 200 linhas.</p>
          <p>A resposta vem com o SQL executado, para o gestor ou a equipe técnica conferirem de onde saiu o número.</p>
          <p>Perguntas sobre pessoas específicas ficam de fora deste canal de propósito: são atendidas pelas telas do núcleo, com controle de acesso.</p>
        </div>
      </Painel>

      <Aviso tom="neutro" className="mt-4">
        Para a equipe de desenvolvimento: os pontos de integração são <span className="cod">GET /assistente/esquema</span> e <span className="cod">POST /assistente/consulta</span> na API, e a variável <span className="cod">GEOF_ASSISTENTE_URL</span>. Detalhes em <span className="cod">docs/seguranca.md</span>.
      </Aviso>
    </Pagina>
  );
}
