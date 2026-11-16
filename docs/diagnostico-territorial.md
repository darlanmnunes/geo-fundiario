# Diagnóstico territorial

O diagnóstico responde a uma pergunta: **o que as bases oficiais dizem sobre esta área?** Ele recebe um
polígono (o perímetro de um núcleo cadastrado ou uma área de estudo livre), consulta cada fonte em tempo
real e devolve um achado por tema, com severidade, base legal, fonte e as feições que servem de evidência.
O resultado alimenta a tela de Inteligência territorial.

## Onde fica no sistema

- **Diagnóstico territorial** (menu principal): escolhe-se um núcleo ou importa-se um polígono em GeoJSON,
  consulta-se as fontes e lê-se cada tema em detalhe: resultado, consequência, base legal, fonte, tempo de
  resposta, números medidos e feições encontradas, que também aparecem no mapa. O resultado pode ser baixado.
- **Gravar no dossiê do núcleo** (perfil de editor): grava os temas que responderam, substitui o valor
  anterior de cada um e recalcula a nota de aptidão. É assim que o diagnóstico alimenta a
  **Inteligência territorial**, que mostra o dossiê gravado de cada núcleo.

## Como funciona

1. **Área de estudo.** O perímetro vigente do núcleo (`GET /projetos/{id}/diagnostico`) ou um polígono em
   GeoJSON, em graus (`POST /diagnostico/area`). A área livre é limitada a 5.000 ha. Nada é gravado até
   alguém com perfil de editor pedir (`POST /projetos/{id}/diagnostico/gravar`).
2. **Conectores.** Cada tema tem uma função em `services/api/src/geo_fundiario/diagnostico.py`. Os conectores
   ligados rodam em paralelo, cada um com tempo limite próprio. Se uma fonte cai, só o tema dela volta como
   "sem dado"; os outros seguem.
3. **Análise.** As feições devolvidas são reprojetadas para o UTM do projeto. Distância ao perímetro, área
   sobreposta e unidades atingidas são medidas em metros nesse plano.
4. **Achado.** Severidade (`impede`, `condiciona`, `atencao`, `ok`, `sem_dado`), resultado em uma frase,
   consequência prática, métricas e até 40 feições de evidência, recortadas ao entorno.

O endereço, o nome da camada e os parâmetros de cada conector ficam no catálogo do banco
(`inteligencia.camada`), não no código. Quando um órgão muda um serviço de lugar, corrige-se uma linha.

## Fontes ligadas

Endereços conferidos em novembro de 2026, com consultas reais sobre Viçosa/MG e Belo Horizonte/MG.

| Tema | Fonte | Serviço | O que o achado diz |
|---|---|---|---|
| Hidrografia e APP | OpenStreetMap | Overpass, com servidores alternativos | Unidades a menos de 30 m de corpo d'água |
| Cursos d'água e dominialidade | ANA, Base Hidrográfica Ottocodificada | ArcGIS REST do SNIRH | Nome do curso d'água mais próximo e domínio (federal ou estadual) |
| Risco geológico | SGB/CPRM, setorização de risco | ArcGIS REST do geoportal | Setores sobre o perímetro, grau, tipologia e unidades atingidas |
| Setor censitário e área urbanizada | IBGE, Censo 2022 | WFS dos geosserviços | Setores, situação urbana, parcela em área urbanizada, favelas e comunidades urbanas |
| Contexto municipal | IBGE, SIDRA (tabelas 4714 e 4712) | API do SIDRA | População, domicílios, moradores por domicílio e densidade |
| Cadastro Ambiental Rural | SICAR | WFS, uma camada por UF | Imóveis do CAR sobre o perímetro e situação |
| Assentamentos e territórios quilombolas | INCRA | WFS público de monitoramento da FUNAI | Sobreposição ou distância ao mais próximo |
| Unidades de conservação e terras indígenas | ICMBio e FUNAI | WFS da INDE e da FUNAI | Sobreposição (com grupo da UC) ou distância, em raio de 3 km |
| Processos minerários | ANM, SIGMINE | ArcGIS REST | Processos ativos sobre o perímetro, fase e substância |
| Rodovias federais e faixas de energia | DNIT (SNV) e ANEEL (DUP) | WFS da INDE e ArcGIS REST do SIGEL | Distância ao eixo de rodovia federal; faixa de utilidade pública de energia |
| Bens tombados e sítios arqueológicos | IPHAN, SICG | WFS | Bens e sítios no perímetro ou a menos de 300 m |

Cuidados adotados:

- Só são consultados endereços em `https`, e o certificado do servidor é sempre validado.
- O titular do processo minerário não é trazido, porque pode ser pessoa física.
- O CAR público não traz dado pessoal. A API do SICAR no Conecta gov.br traz CPF e nome do cadastrante e
  exige adesão do órgão; ela não é usada.
- Se o servidor do OpenStreetMap não responde, o tema de hidrografia usa a hidrografia já guardada no banco
  para o núcleo e avisa isso no resultado.

## Fontes ainda não ligadas

| Tema | Situação |
|---|---|
| Parcelas certificadas (SIGEF e SNCI) | O acervo fundiário do INCRA não tinha serviço público no ar em novembro de 2026, e o portal do SIGEF recusa cliente automatizado. O caminho é importar o arquivo baixado do SIGEF ou usar credencial do órgão. |
| Uso e cobertura da terra (MapBiomas) | A consulta pública devolve só os recortes territoriais. A série de cobertura e os alertas exigem conta na plataforma. |
| UCs estaduais e municipais | Estão no Cadastro Nacional de UCs (MMA, pela INDE), mas o nome da camada muda a cada versão. Falta o conector descobrir o nome pelo próprio serviço. |
| Marco temporal | Depende de imagens históricas e de interpretação. |
| Declividade | Depende do modelo digital de elevação; conector não escrito. |
| Zoneamento, ZEIS e infraestrutura | Dados do município: entram por arquivo ou serviço da prefeitura. |
| Matrículas atingidas | Depende de convênio com o Registro de Imóveis. |

Enquanto um tema não tem conector, o dossiê mostra o valor de demonstração e declara que ele é simulado.

## Limites do que o diagnóstico afirma

- Ele relata o que a fonte publica na data da consulta. Base desatualizada ou município não coberto aparecem
  como "sem restrição"; por isso cada achado traz a fonte e, quando cabe, o aviso do que ela não cobre.
- A nota de aptidão parte de 100 e desconta por achado: 40 por tema que impede, 12 por tema que condiciona,
  4 por tema que pede atenção e 2 por tema sem dado. É um indicador de triagem, não um parecer.
- O diagnóstico de área livre não é gravado: só o de núcleo cadastrado alimenta um dossiê.
- A área livre entra por arquivo ou texto em GeoJSON; desenhar no mapa ainda não existe.
- A busca usa a caixa envolvente do perímetro mais um entorno (150 m a 3 km, conforme o tema).

## Como acrescentar uma fonte

1. Escrever uma função `conector(area, endpoint, parametros)` que devolve `_achado(...)`. Os auxiliares
   `wfs`, `arcgis`, `relacionar` e `evidencias` cobrem a maior parte dos casos.
2. Registrar a função em `CONECTORES`.
3. Criar a próxima migração inserindo a linha em `inteligencia.camada`, com `situacao_conector = 'ao_vivo'`.

## Preparação para o SINTER

O Sistema Nacional de Gestão de Informações Territoriais (Dec. 11.208/2022) reúne os cadastros de origem,
entre eles os cadastros imobiliários municipais, e identifica cada unidade imobiliária pelo código do
Cadastro Imobiliário Brasileiro (CIB): sete caracteres alfanuméricos e um dígito verificador.

O que já está alinhado:

| Exigência | No Geo-Fundiário |
|---|---|
| Cadastro georreferenciado ao Sistema Geodésico Brasileiro (art. 3º, II) | Geometria canônica em SIRGAS 2000, vértices com método e precisão |
| Identificador CIB (art. 4º) | Coluna `ladm.la_baunit.cib`, com formato validado e unicidade entre as versões vigentes |
| Chave do cadastro municipal | `ladm.la_baunit.inscricao_imobiliaria` |
| Dados de registro | `ladm.la_baunit.matricula` e `cri_cns` |
| Titulares e tipo de titularidade | `ladm.la_party` e `ladm.la_rrr` |
| Histórico das alterações | Versionamento temporal e auditoria |

O que falta e depende de terceiros:

- **Convênio.** O município adere por convênio com a Receita Federal e indica os usuários que transmitem.
- **Envio.** A Receita publica quatro formas de integração para o cadastro urbano: formulário, API de uma
  unidade, API em lote e arquivo. O arquivo é um ZIP com um imóvel por linha (NDJSON) e a operação de
  inclusão, alteração ou desativação. O exportador nesse formato ainda não foi escrito.
- **De-para.** Os domínios e os campos obrigatórios estão no Manual Operacional do SINTER, que não foi lido
  para este documento. Antes de escrever o exportador é preciso conferir, nesse manual, a tabela de
  correspondência entre o cadastro e os blocos de dados gerais, endereço, titulares e registro, e como a
  geometria da parcela é enviada.

Fontes: [Decreto 11.208/2022](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/D11208.htm)
e as orientações aos municípios publicadas pela
[Receita Federal](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/sinter).
