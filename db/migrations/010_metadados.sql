-- Metadados dos conjuntos de dados, no Perfil de Metadados Geoespaciais do Brasil (MGB 2.0, sobre a
-- ISO 19115-1:2014), para que o que a plataforma produz possa ser catalogado na INDE sem retrabalho.
-- A qualidade posicional segue a ISO 19157: o valor declarado aqui resume o que está medido,
-- vértice a vértice, em ladm.la_point (sigma_e, sigma_n, sigma_h).

create schema if not exists metadados;
comment on schema metadados is 'Metadados geoespaciais (Perfil MGB 2.0 / ISO 19115-1) e correspondência do modelo com normas';

create table metadados.conjunto_dados (
  id bigint generated always as identity primary key,
  identificador uuid not null unique default gen_random_uuid(),   -- fileIdentifier
  projeto_id bigint references reurb.projeto on delete cascade,
  levantamento_id bigint references campo.levantamento on delete set null,
  titulo text not null,
  resumo text not null,
  tipo_representacao text not null default 'vetorial' check (tipo_representacao in ('vetorial','matricial','tabular','tin')),
  categoria_tematica text not null default 'planningCadastre',   -- MD_TopicCategoryCode
  palavras_chave text[] not null default '{}',
  responsavel_nome text not null,
  responsavel_papel text not null default 'pointOfContact',      -- CI_RoleCode
  sistema_referencia text not null default 'EPSG:4674',          -- SIRGAS 2000 geográfico
  sistema_referencia_vertical text default 'Datum Imbituba (SGB)',
  escala_denominador int,
  acuracia_posicional_m numeric(6,3),                            -- DQ_AbsoluteExternalPositionalAccuracy
  metodo_avaliacao text,
  linhagem text,                                                 -- LI_Lineage: como o dado foi produzido
  data_referencia date,
  frequencia_atualizacao text default 'asNeeded',                -- MD_MaintenanceFrequencyCode
  restricao_acesso text not null default 'restricted',           -- MD_RestrictionCode
  restricao_uso text,
  licenca text,
  extensao geometry(Polygon, 4674),
  idioma char(3) not null default 'por',
  perfil text not null default 'MGB 2.0 (ISO 19115-1:2014)',
  atualizado_em timestamptz not null default now()
);
create index conjunto_dados_extensao on metadados.conjunto_dados using gist (extensao);

-- De qual classe de norma cada tabela é a realização. Documenta o modelo e orienta as próximas tabelas.
create table metadados.correspondencia_modelo (
  tabela text primary key,
  norma text not null,
  classe text not null,
  observacao text
);
insert into metadados.correspondencia_modelo values
  ('ladm.la_party',            'ISO 19152-1:2024', 'LA_Party',                 'Pessoa física, jurídica, grupo ou ente público'),
  ('ladm.la_partymember',      'ISO 19152-1:2024', 'LA_PartyMember',           'Composição de grupos (família, condomínio)'),
  ('ladm.la_baunit',           'ISO 19152-1:2024', 'LA_BAUnit',                'Unidade administrativa básica: o imóvel como objeto de direitos'),
  ('ladm.la_rrr',              'ISO 19152-1:2024', 'LA_RRR (LA_Right, LA_Restriction, LA_Responsibility)', 'A classe do registro vem de ladm.cl_rrr_type.classe'),
  ('ladm.la_source',           'ISO 19152-1:2024', 'LA_AdministrativeSource',  'Título, matrícula, contrato ou declaração que fundamenta o direito'),
  ('ladm.la_spatialunit',      'ISO 19152-1:2024', 'LA_SpatialUnit',           'Núcleo, quadra, lote, edificação, unidade autônoma e área pública (ladm.cl_spatialunit_level = LA_Level)'),
  ('ladm.la_point',            'ISO 19152-1:2024', 'LA_Point',                 'Vértice medido, com método e desvios-padrão (qualidade conforme ISO 19157)'),
  ('ladm.la_spatialunit_point','ISO 19152-1:2024', 'LA_BoundaryFaceString',    'Sequência ordenada de vértices que fecha o limite da unidade'),
  ('campo.levantamento',       'ISO 19152-1:2024', 'LA_SpatialSource',         'Campanha de medição: equipamento, norma, responsável técnico'),
  ('documentos.documento',     'ISO 19152-1:2024', 'ExtArchive',               'Arquivo externo endereçado por SHA-256'),
  ('reurb.projeto',            'Lei 13.465/2017',  'Processo de REURB',        'Módulo; referencia o núcleo cadastral, não o duplica'),
  ('reurb.unidade_situacao',   'Lei 13.465/2017',  'Situação da unidade no processo', 'Módulo'),
  ('metadados.conjunto_dados', 'ISO 19115-1:2014', 'MD_Metadata',              'Perfil MGB 2.0, para catalogação na INDE');

grant usage on schema metadados to geof_api, geof_leitura, geof_consulta;
grant select on all tables in schema metadados to geof_api, geof_leitura, geof_consulta;
grant insert, update on metadados.conjunto_dados to geof_api;
grant usage, select on all sequences in schema metadados to geof_api;
