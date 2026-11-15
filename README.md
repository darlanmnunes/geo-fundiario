# Geo-Fundiário

Plataforma aberta de **gestão fundiária e territorial**: do levantamento de campo às peças técnicas, do cadastro ao registro. Código livre, da estrutura do banco à interface.

O primeiro módulo é a **Regularização Fundiária Urbana (REURB)**, conforme a Lei 13.465/2017. O núcleo cadastral (LADM, ISO 19152), a geodésia, os documentos e a inteligência territorial são compartilhados e servem de base para os próximos módulos.

> Estado: **protótipo funcional**. Os dados de demonstração são fictícios: três núcleos simulados sobre edificações do campus da UFV (geometria do OpenStreetMap, ODbL). Nenhum desses prédios está em regularização.
>
> Desenvolvido pelo GPGeoIA - Grupo de Pesquisa em Inteligência Artificial Geoespacial da UFV. Responsável: Prof. Dr. Darlan Miranda Nunes.

| Módulo | Situação |
|---|---|
| REURB — regularização fundiária urbana | protótipo funcional |
| Inteligência territorial — dossiê de áreas a partir de camadas públicas | protótipo com dados simulados |
| Cadastro territorial multifinalitário, regularização rural, georreferenciamento de imóveis | planejados |

## O que o módulo REURB faz hoje

| Área | Capacidade |
|---|---|
| **Mesa de trabalho** | Todos os núcleos com a trilha das dez fases, lotes por situação e o que exige decisão hoje: prazos legais, impugnações, assinaturas pendentes |
| **Mapa e processo** | Workspace com ortofoto, lotes coloridos por situação, filtro por situação, inspetor do lote, navegação por teclado, fases do art. 28 com prazos e documentos de cada fase |
| **Cadastro** | Lotes e ocupantes com renda, família, CPF (mascarado), documentos faltantes; perfil socioeconômico (renda, idade, escolaridade, ocupação) |
| **Ficha do lote** | Vértices com método e erro posicional, azimutes e distâncias, confrontantes por topologia, critérios de legitimação fundiária (art. 23), documentos do ocupante e **memorial descritivo gerado dos vértices** |
| **Levantamento** | Controle de qualidade: erro esférico por vértice contra o limite de 8 cm (Dec. 9.310/2018, art. 29), histograma e lista do que precisa ser remedido |
| **Notificações** | Art. 31: destinatário, meio (AR, edital), ciência, prazo de 30 dias e resposta |
| **Documentos e peças** | Autos do processo por fase, com código de verificação pública e assinaturas (ICP-Brasil / gov.br); situação das peças do art. 35 |
| **Inteligência territorial** | Dossiê de uma área cruzando camadas públicas (marco temporal, APP, risco, censo, zoneamento, matrículas, CAR, SIGEF, UC/TI, infraestrutura), cada achado com severidade e base legal — achados simulados nesta versão |
| **Busca (⌘K)** | Lotes, ocupantes, fases, documentos e páginas |

## Arquitetura

```
apps/web  (Next.js 16, React 19, Tailwind 4, MapLibre)  ──►  services/api (FastAPI, Python 3.12)  ──►  PostgreSQL + PostGIS
  páginas estáticas + seed offline                             memorial, qualidade, documentos,          ladm.*        ISO 19152
  base vetorial OpenFreeMap / imagens Esri                      verificação pública, exportação           reurb.*       Lei 13.465/2017
                                                                arquivos em disco ou S3 (por SHA-256)     campo.*       levantamento e cadastro social
                                                                                                          documentos.*  anexos, versões, assinaturas
                                                                                                          inteligencia.* fontes, dossiês, achados
                                                                                                          auditoria.*   toda alteração
```

Decisões de modelagem:
- **Núcleo cadastral em LADM (ISO 19152)**: pessoas, unidades administrativas básicas, direitos/restrições/responsabilidades, unidades espaciais e vértices com precisão e método. Versionamento temporal: nada é sobrescrito.
- **Geometria canônica em SIRGAS 2000 geográfico (EPSG:4674)**; área, perímetro, azimutes e distâncias calculados no UTM do projeto (`reurb.projeto.srid_utm`).
- **Documentos**: metadados e vínculos no PostgreSQL (`jsonb` para o que é flexível, `tsvector` para busca), bytes fora do banco endereçados pelo SHA-256 (disco agora, S3/MinIO depois). Cada documento tem código de verificação pública; assinaturas ficam em tabela própria. Não há segundo banco.
- **Fases com prazos legais** modeladas como catálogo (`reurb.fase`), não como etapas livres.

## Como rodar

Pré-requisitos: Node 20+, [uv](https://docs.astral.sh/uv/), PostgreSQL 14+ com PostGIS 3 (no macOS, Postgres.app).

```bash
# 1. Banco
createdb geo_fundiario
for f in db/migrations/*.sql; do psql -d geo_fundiario -v ON_ERROR_STOP=1 -1 -f "$f"; done

# 2. Dados de demonstração (fictícios, sobre edificações do campus da UFV tiradas do OpenStreetMap)
(cd services/api && uv run python scripts/gerar_seed.py)
psql -d geo_fundiario -f db/seed/seed.sql

# 3. Instantâneo que a interface lê (JSON) e GeoPackage de cada núcleo
(cd services/api && uv run python scripts/exportar_instantaneo.py)

# 4. Primeiro administrador (a senha é pedida no terminal)
(cd services/api && uv run python scripts/criar_admin.py "Seu Nome" voce@exemplo.br)

# 5. API em http://localhost:8000/docs
(cd services/api && uv run uvicorn geo_fundiario.main:app --reload --port 8000)

# 6. Interface em http://localhost:3000, ligada à API (login, edição e leitura ao vivo)
(cd apps/web && npm install && NEXT_PUBLIC_API_URL=http://localhost:8000 GEOF_API_URL=http://localhost:8000 npm run dev)
```

**O banco é a única fonte de dados.** Sem `GEOF_API_URL`, a interface lê o instantâneo exportado do banco
(`apps/web/src/data/instantaneo.json`); é assim que a demonstração estática funciona. Sem
`NEXT_PUBLIC_API_URL`, ela fica somente de leitura.

Verificação:

```bash
(cd services/api && uv run pytest && uv run ruff check src tests scripts)
(cd apps/web && npm run typecheck && npm run lint && npm run build)
```

Segurança, perfis de acesso e passos para produção: [docs/seguranca.md](docs/seguranca.md).

## Demonstração pública

O fluxo `.github/workflows/pages.yml` publica a interface como site estático, somente de leitura, no GitHub Pages a cada push em `main` (`NEXT_OUTPUT=export`). Ative **Settings → Pages → Source: GitHub Actions** no repositório. Para gerar localmente: `NEXT_OUTPUT=export NEXT_BASE_PATH=/<nome-do-repo> npm run build` em `apps/web` (saída em `out/`).

## Próximos passos

1. Interface lendo a API (hoje lê o seed) e formulários de edição com trilha de auditoria visível.
2. Importação de levantamentos (CSV GNSS/estação total, shapefile, GeoPackage, DXF) e fotos de fachada com coordenadas.
3. Emissão de peças em PDF/DOCX com QR de verificação: memoriais, planta, CRF, listagem de ocupantes, notificações, edital.
4. Inteligência territorial com camadas reais (WFS/arquivos) e desenho livre de áreas.
5. App de campo offline (PWA) para cadastro socioeconômico e coleta.
6. Integração com o Registro de Imóveis (ONR/SAEC) quando o leiaute oficial for verificado.
7. Autenticação e perfis: prefeitura, equipe técnica, cartório, beneficiário.

## Licença

Código sob a **GNU Affero General Public License v3.0 ou posterior** ([LICENSE](LICENSE)). Quem usar ou oferecer o sistema como serviço, inclusive modificado, disponibiliza o código correspondente nos mesmos termos. Material didático e documentação de apoio terão licença própria, indicada em cada arquivo quando publicados.
