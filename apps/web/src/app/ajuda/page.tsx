import Link from "next/link";
import { FiguraArquitetura, FiguraCaminho, FiguraEntrada, FiguraErroPosicional, FiguraLadm, FiguraNucleo, FiguraVisaoGeral } from "@/components/ilustracoes";
import { Cabecalho, Pagina, Ponto } from "@/components/ui";
import { NORMAS, REPOSITORIO, SITUACAO_LOTE, SITUACOES } from "@/lib/dominio";

export const metadata = { title: "Ajuda" };

const SECOES = [
  ["o-que-e", "O que é o sistema"],
  ["caminho", "O caminho de um núcleo"],
  ["visao-geral", "A tela Visão geral"],
  ["nucleo", "A tela de um núcleo"],
  ["mapa", "Como ler o mapa"],
  ["pecas", "Memorial e planta"],
  ["precisao", "Precisão posicional"],
  ["entrada", "Como os dados entram"],
  ["acesso", "Acesso e permissões"],
  ["dados", "Modelo de dados"],
  ["arquitetura", "Arquitetura do sistema"],
  ["perguntas", "Perguntas frequentes"],
  ["glossario", "Glossário"],
  ["creditos", "Créditos e fontes"],
] as const;

function Secao({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-borda pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-[19px] leading-tight font-semibold">{titulo}</h2>
      <div className="mt-2.5 space-y-3 text-[14.5px] leading-relaxed text-texto-2">{children}</div>
    </section>
  );
}

function Legendas({ itens }: { itens: [string, string][] }) {
  return (
    <ol className="space-y-2">
      {itens.map(([t, d], i) => (
        <li key={t} className="grid grid-cols-[1.6rem_1fr] gap-2">
          <span className="num mt-px flex size-[22px] items-center justify-center rounded-full border border-texto bg-[#ffd23d] text-[13px] font-bold text-texto">{i + 1}</span>
          <span><b className="text-texto">{t}.</b> {d}</span>
        </li>
      ))}
    </ol>
  );
}

const lei = (k: keyof typeof NORMAS, texto?: string) => <a href={NORMAS[k].url} target="_blank" rel="noreferrer" className="text-azul hover:underline">{texto ?? NORMAS[k].rotulo}</a>;

export default function Ajuda() {
  return (
    <Pagina>
      <Cabecalho titulo="Ajuda" descricao="Como o Geo-Fundiário funciona, o que cada tela mostra e como usar no dia a dia." />
      <div className="mt-5 grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label="Nesta página" className="top-16 self-start text-[14px] lg:sticky">
          <ul className="space-y-0.5 border-l border-borda">
            {SECOES.map(([id, t]) => <li key={id}><a href={`#${id}`} className="-ml-px block border-l-2 border-transparent py-1 pl-3 text-texto-2 hover:border-azul hover:text-azul">{t}</a></li>)}
          </ul>
        </nav>

        <div className="painel max-w-[920px] space-y-7 p-5 sm:p-7">
          <Secao id="o-que-e" titulo="O que é o sistema">
            <p className="max-w-[72ch]">
              O Geo-Fundiário é uma plataforma aberta de gestão fundiária e territorial. O primeiro módulo conduz a Regularização Fundiária Urbana (REURB), prevista na {lei("lei13465")}: do levantamento de campo ao registro em cartório.
            </p>
            <p className="max-w-[72ch]">
              Ele junta num lugar só o que costuma ficar espalhado em planilhas, pastas e arquivos de desenho: as unidades e seus vértices, os ocupantes e seus documentos, as fases do processo com os prazos legais, as notificações e as peças técnicas.
            </p>
          </Secao>

          <Secao id="caminho" titulo="O caminho de um núcleo">
            <FiguraCaminho />
            <p className="max-w-[72ch]">
              Um <b className="text-texto">núcleo</b> é uma ocupação urbana informal em regularização. Cada núcleo percorre dez fases, sete delas previstas em lei e três de apoio técnico. A página <Link href="/legislacao" className="text-azul hover:underline">Base legal</Link> mostra cada fase, quem conduz, o prazo e o que ela entrega.
            </p>
          </Secao>

          <Secao id="visao-geral" titulo="A tela Visão geral">
            <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <FiguraVisaoGeral />
              <Legendas itens={[
                ["Filtro de núcleo", "escolha um núcleo e tudo abaixo passa a mostrar só ele"],
                ["Indicadores", "totais de unidades, pessoas, unidades aptas à CRF, pendências e precisão do levantamento"],
                ["Mapa", "todos os núcleos; clique numa unidade para abrir a ficha dela"],
                ["Unidades por situação", "clicar numa barra filtra o painel inteiro e o mapa"],
                ["Exige decisão", "prazos legais correndo, impugnações, assinaturas pendentes e vértices a remedir"],
                ["Andamento", "a fase de cada núcleo e o botão Abrir"],
              ]} />
            </div>
          </Secao>

          <Secao id="nucleo" titulo="A tela de um núcleo">
            <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <FiguraNucleo />
              <Legendas itens={[
                ["Voltar e abas", "o botão Visão geral volta ao painel; as abas levam a cadastro, levantamento, notificações e documentos"],
                ["Processo", "as dez fases; clique numa para ver descrição, prazo e documentos juntados"],
                ["Mapa", "as unidades coloridas pela situação; clique para selecionar, setas do teclado para percorrer"],
                ["Painel da unidade", "ocupante, pendências e o botão que abre a ficha com vértices, memorial e planta"],
              ]} />
            </div>
          </Secao>

          <Secao id="mapa" titulo="Como ler o mapa">
            <p className="max-w-[72ch]">Cada unidade tem a cor da sua situação no processo. As cores são as mesmas em todos os mapas, gráficos e tabelas.</p>
            <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {SITUACOES.map((s) => <li key={s} className="flex items-start gap-2"><Ponto cor={SITUACAO_LOTE[s].cor} className="mt-1.5" /><span><b className="text-texto">{SITUACAO_LOTE[s].rotulo}.</b> {SITUACAO_LOTE[s].descricao}.</span></li>)}
            </ul>
            <p className="max-w-[72ch]">
              À direita do mapa há três botões: <b className="text-texto">Camadas de dados</b> (liga ou desliga unidades, quadras, perímetro, logradouros e hidrografia), <b className="text-texto">Mapa base</b> (mapa do OpenStreetMap, cinza claro, imagem de satélite ou híbrido) e <b className="text-texto">Legenda</b>. À esquerda ficam o zoom, a orientação e a pesquisa por unidade ou ocupante. A linha tracejada é o perímetro do núcleo.
            </p>
          </Secao>

          <Secao id="pecas" titulo="Memorial e planta">
            <p className="max-w-[72ch]">
              Na ficha de cada unidade o sistema redige o <b className="text-texto">memorial descritivo</b> a partir dos vértices medidos: quadro do imóvel, descrição do perímetro com coordenadas, azimutes planos, distâncias e confrontantes, e o fecho com as assinaturas. O confrontante de cada lado vem da topologia: a unidade vizinha, o logradouro ou o corpo d&apos;água mais próximo.
            </p>
            <p className="max-w-[72ch]">
              A <b className="text-texto">planta da unidade</b> sai na mesma ficha, em folha A3, com malha de coordenadas UTM, escala gráfica, quadro de vértices e selo. Pode ser impressa ou salva em PDF pelo navegador, e baixada em DXF (coordenadas reais, em camadas) para AutoCAD ou LibreCAD, ou em GeoPackage do núcleo inteiro para editar no QGIS. O memorial também sai em Word (.docx), já formatado.
            </p>
          </Secao>

          <Secao id="precisao" titulo="Precisão posicional">
            <div className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <FiguraErroPosicional />
              <div className="space-y-3">
                <p>
                  O {lei("dec9310")} (art. 29, §3º) exige que o “erro posicional esférico” de cada vértice definidor de limite seja de até 8 cm de raio. Na engenharia de agrimensura e cartográfica o nome corrente é <b className="text-texto">erro posicional tridimensional</b>: a resultante dos desvios-padrão nas três componentes.
                </p>
                <p>A tolerância não é sempre 8 cm: depende da norma do trabalho. No georreferenciamento de imóveis rurais, por exemplo, avalia-se o erro planimétrico, com 0,50 m para limites artificiais, 3,00 m para naturais e 7,50 m para inacessíveis. Cada projeto tem a sua norma cadastrada, e é contra ela que o sistema confere cada vértice, na aba Levantamento.</p>
              </div>
            </div>
          </Secao>

          <Secao id="entrada" titulo="Como os dados entram no sistema">
            <FiguraEntrada />
            <p className="max-w-[72ch]">Há três portas de entrada, todas terminando no mesmo banco e todas registradas na auditoria:</p>
            <ol className="max-w-[72ch] list-decimal space-y-1.5 pl-5">
              <li><b className="text-texto">Pelo navegador, com login.</b> Quem tem perfil de editor muda a situação de uma unidade, abre e resolve pendências, corrige o cadastro social e anexa documentos (PDF ou imagem) na ficha da unidade. Não é preciso conhecer SIG nem banco de dados.</li>
              <li><b className="text-texto">Pelo QGIS.</b> A equipe técnica baixa o GeoPackage do núcleo na ficha de qualquer unidade (unidades, quadras, perímetro, vértices e logradouros), edita e devolve para carga. A carga de volta pelo navegador é a próxima etapa do desenvolvimento.</li>
              <li><b className="text-texto">Por importação de levantamento.</b> Vértices medidos (GNSS e estação total), com método e desvios-padrão, entram por arquivo e formam as unidades. Hoje isso é feito pela equipe de implantação; a tela de importação está prevista.</li>
            </ol>
            <p className="max-w-[72ch]">A demonstração pública na internet é somente de leitura: ela mostra um instantâneo do banco e não tem servidor para receber alterações.</p>
          </Secao>

          <Secao id="acesso" titulo="Acesso e permissões">
            <p className="max-w-[72ch]">
              A consulta ao painel é aberta. Para alterar qualquer coisa é preciso <Link href="/entrar" className="text-azul hover:underline">entrar</Link> com e-mail e senha. As contas são criadas pelo administrador, em Usuários, que escolhe o perfil de cada pessoa:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full max-w-[720px] text-[14px]">
                <thead><tr className="border-b border-borda-forte text-left text-[13px] text-texto"><th scope="col" className="py-1.5 pr-4 font-semibold">Perfil</th><th scope="col" className="py-1.5 pr-4 font-semibold">Consulta</th><th scope="col" className="py-1.5 pr-4 font-semibold">Edita dados e documentos</th><th scope="col" className="py-1.5 font-semibold">Gerencia usuários</th></tr></thead>
                <tbody className="divide-y divide-borda">
                  {[["Leitor", "Sim", "Não", "Não"], ["Editor", "Sim", "Sim", "Não"], ["Administrador", "Sim", "Sim", "Sim"]].map((l) => <tr key={l[0]}>{l.map((c, i) => <td key={i} className={i ? "py-1.5 pr-4" : "py-1.5 pr-4 font-semibold text-texto"}>{c}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
            <p className="max-w-[72ch]">
              O primeiro administrador é criado na implantação. A senha nunca é guardada: o banco guarda só uma derivação irreversível dela. A sessão vale 12 horas e termina ao fechar a aba. Bloquear um usuário encerra na hora as sessões abertas dele. Cada gravação leva para a auditoria o e-mail de quem fez, a data e o valor anterior.
            </p>
          </Secao>

          <Secao id="dados" titulo="Modelo de dados">
            <p className="max-w-[72ch]">
              O banco segue o LADM ({lei("iso19152")}), o modelo internacional para administração territorial. Em vez de uma tabela de “lotes” com tudo dentro, separa quem tem o direito, qual é o direito, sobre qual imóvel, onde ele fica e com que prova.
            </p>
            <FiguraLadm />
            <p className="max-w-[72ch]">
              Nada é sobrescrito: cada alteração fecha a versão anterior e abre outra, e toda mudança fica na trilha de auditoria. Os metadados seguem o Perfil de Metadados Geoespaciais do Brasil (MGB 2.0, sobre a ISO 19115), para catalogação na INDE. O módulo de REURB só referencia esse núcleo cadastral, e os próximos módulos (cadastro multifinalitário, regularização rural) farão o mesmo.
            </p>
          </Secao>

          <Secao id="arquitetura" titulo="Arquitetura do sistema">
            <FiguraArquitetura />
            <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              <p><b className="text-texto">Um banco só.</b> PostgreSQL com PostGIS guarda geometria, cadastro, processo, metadados de documentos e auditoria, em esquemas separados por assunto. Os arquivos (PDF, fotos) ficam fora do banco, num armazenamento de objetos, endereçados pelo resumo SHA-256: é o arranjo que escala para milhões de documentos sem um segundo banco para manter em sincronia.</p>
              <p><b className="text-texto">A API é a única que grava.</b> Ela valida, identifica o autor e aplica as regras (por exemplo: unidade com pendência em aberto não pode ser marcada como apta à CRF). A interface e o QGIS nunca escrevem direto nas tabelas.</p>
              <p><b className="text-texto">Geometria e cálculo.</b> A geometria canônica fica em SIRGAS 2000 geográfico. Áreas, distâncias e azimutes são calculados no plano que o projeto definir: projeção UTM ou Sistema Geodésico Local (NBR 14166 e NBR 17047). A tolerância posicional vem da norma cadastrada no projeto.</p>
              <p><b className="text-texto">Módulos.</b> REURB é o primeiro. Diagnóstico territorial consulta fontes externas por conectores. Cadastro multifinalitário e regularização rural entram como novos esquemas que referenciam o mesmo núcleo cadastral.</p>
            </div>
          </Secao>

          <Secao id="perguntas" titulo="Perguntas frequentes">
            {[
              ["Os dados que aparecem são reais?", "Não. Pessoas, rendas, documentos e processos são inventados. A geometria vem de edificações do campus da UFV no OpenStreetMap, usadas só como cenário: nenhum desses prédios está em regularização."],
              ["Como encontro uma unidade ou uma pessoa?", "Use Buscar, no alto da página, ou o atalho Ctrl K (Cmd K no Mac). A busca aceita o código da unidade, o nome do ocupante, uma fase ou o título de um documento."],
              ["O que significa uma unidade com pendência?", "Há algo em aberto que impede a unidade de constar da CRF: documento obrigatório faltando, impedimento jurídico do ocupante ou questão ambiental. A ficha da unidade lista cada pendência com a base legal."],
              ["O prazo aparece em vermelho. E agora?", "Vermelho indica prazo vencido ou a menos de 7 dias do fim; amarelo, a menos de 30. O item aparece em Exige decisão, com atalho para a tela onde se resolve."],
              ["Posso usar o sistema no meu município?", "Sim. O código é aberto, sob licença AGPL-3.0: pode ser usado, estudado e modificado, desde que as modificações oferecidas como serviço também sejam abertas."],
            ].map(([p, r]) => (
              <details key={p} className="group rounded border border-borda open:bg-realce">
                <summary className="cursor-pointer px-3.5 py-2 text-[14.5px] font-semibold text-texto marker:text-texto-3">{p}</summary>
                <p className="max-w-[72ch] px-3.5 pb-3">{r}</p>
              </details>
            ))}
          </Secao>

          <Secao id="glossario" titulo="Glossário">
            <dl className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {[
                ["REURB-S", "Regularização de interesse social: núcleos ocupados predominantemente por população de baixa renda."],
                ["REURB-E", "Regularização de interesse específico: os demais casos."],
                ["CRF", "Certidão de Regularização Fundiária, o ato final do procedimento, que vai a registro."],
                ["Legitimação fundiária", "Forma originária de aquisição do direito real de propriedade, conferida pelo poder público na REURB."],
                ["Confrontante", "Quem faz divisa com a unidade: outra unidade, um logradouro, uma área pública."],
                ["APP", "Área de Preservação Permanente, como as faixas marginais de cursos d'água."],
                ["Marco temporal", "22 de dezembro de 2016: só núcleos consolidados até essa data entram na REURB."],
                ["SIRGAS 2000", "Sistema geodésico de referência oficial do Brasil."],
              ].map(([t, d]) => <div key={t}><dt className="font-semibold text-texto">{t}</dt><dd>{d}</dd></div>)}
            </dl>
          </Secao>

          <Secao id="creditos" titulo="Créditos e fontes">
            <p className="max-w-[72ch]">
              Desenvolvido pelo <b className="text-texto">GPGeoIA - Grupo de Pesquisa em Inteligência Artificial Geoespacial</b> da Universidade Federal de Viçosa (UFV).
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Código-fonte: <a className="text-azul hover:underline" href={REPOSITORIO} target="_blank" rel="noreferrer">github.com/darlanmnunes/geo-fundiario</a>, licença AGPL-3.0 ou posterior.</li>
              <li>Mapas de base: dados © colaboradores do <a className="text-azul hover:underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> (ODbL), servidos pelo <a className="text-azul hover:underline" href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>; imagens de satélite © Esri, Maxar, Earthstar Geographics.</li>
              <li>Geometria da demonstração: edificações, vias e corpos d&apos;água do OpenStreetMap (ODbL).</li>
              <li>Componentes: MapLibre GL JS, Next.js, PostgreSQL com PostGIS.</li>
            </ul>
          </Secao>
        </div>
      </div>
    </Pagina>
  );
}
