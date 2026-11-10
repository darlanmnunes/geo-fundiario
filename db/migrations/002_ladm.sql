-- Núcleo LADM (ISO 19152), perfil enxuto para cadastro urbano brasileiro.
-- Todas as classes LADM carregam versionamento temporal (begin/end_lifespan_version):
-- alterações fecham a versão vigente e abrem outra, nunca sobrescrevem.

-- Listas de códigos (code lists) ------------------------------------------------
create table ladm.cl_party_type (code text primary key, descricao text not null);
insert into ladm.cl_party_type values
  ('pf', 'Pessoa física'), ('pj', 'Pessoa jurídica'), ('grupo', 'Grupo de pessoas (família, condomínio)'),
  ('ente_publico', 'Ente público');

create table ladm.cl_rrr_type (code text primary key, classe text not null check (classe in ('direito','restricao','responsabilidade')), descricao text not null);
insert into ladm.cl_rrr_type values
  ('propriedade', 'direito', 'Propriedade (matrícula)'),
  ('posse', 'direito', 'Posse (ocupação)'),
  ('legitimacao_fundiaria', 'direito', 'Legitimação fundiária — art. 23 Lei 13.465/2017'),
  ('legitimacao_posse', 'direito', 'Legitimação de posse — art. 25 Lei 13.465/2017'),
  ('direito_laje', 'direito', 'Direito real de laje — art. 1.510-A Código Civil'),
  ('concessao_uso_moradia', 'direito', 'Concessão de uso especial para fins de moradia'),
  ('app', 'restricao', 'Área de Preservação Permanente'),
  ('area_risco', 'restricao', 'Área de risco geotécnico/hidrológico'),
  ('servidao', 'restricao', 'Servidão administrativa'),
  ('hipoteca', 'restricao', 'Hipoteca / alienação fiduciária'),
  ('obrigacao_infraestrutura', 'responsabilidade', 'Responsabilidade por obra de infraestrutura essencial (art. 36)');

create table ladm.cl_spatialunit_level (code text primary key, descricao text not null);
insert into ladm.cl_spatialunit_level values
  ('nucleo', 'Núcleo urbano informal'), ('quadra', 'Quadra'), ('lote', 'Lote / parcela'),
  ('edificacao', 'Edificação'), ('unidade_autonoma', 'Unidade autônoma / laje'), ('area_publica', 'Área pública / sistema viário');

create table ladm.cl_point_method (code text primary key, descricao text not null);
insert into ladm.cl_point_method values
  ('gnss_rtk', 'GNSS RTK'), ('gnss_ppp', 'GNSS pós-processado (PPP/relativo)'),
  ('estacao_total', 'Estação total (irradiação/poligonação)'),
  ('aerofoto', 'Aerofotogrametria / ortofoto (VANT)'), ('digitalizado', 'Digitalizado de base cartográfica');

create table ladm.cl_point_type (code text primary key, descricao text not null);
insert into ladm.cl_point_type values
  ('M', 'Marco implantado'), ('P', 'Ponto de divisa sem marco'), ('V', 'Vértice virtual / calculado');

-- Pessoas -------------------------------------------------------------------------
create table ladm.la_party (
  id bigint generated always as identity primary key,
  party_type text not null references ladm.cl_party_type,
  nome text not null,
  cpf_cnpj text unique,
  nis text,
  data_nascimento date,
  estado_civil text,
  regime_bens text,
  contato jsonb not null default '{}'::jsonb,
  begin_lifespan_version timestamptz not null default now(),
  end_lifespan_version timestamptz
);
create index la_party_nome_trgm on ladm.la_party using gin (nome gin_trgm_ops);

create table ladm.la_partymember (
  grupo_id bigint not null references ladm.la_party on delete cascade,
  membro_id bigint not null references ladm.la_party on delete restrict,
  papel text not null default 'membro',      -- titular, conjuge, companheiro, dependente
  fracao numeric(9,6),
  primary key (grupo_id, membro_id)
);

-- Unidade administrativa básica (o "imóvel" no sentido jurídico) -----------------
create table ladm.la_baunit (
  id bigint generated always as identity primary key,
  nome text,
  matricula text,                  -- matrícula no Registro de Imóveis, quando houver
  cri_cns text,                    -- CNS do cartório
  inscricao_imobiliaria text,      -- cadastro fiscal municipal
  uso text,
  begin_lifespan_version timestamptz not null default now(),
  end_lifespan_version timestamptz
);

-- Direitos, restrições e responsabilidades ---------------------------------------
create table ladm.la_rrr (
  id bigint generated always as identity primary key,
  baunit_id bigint not null references ladm.la_baunit on delete cascade,
  party_id bigint references ladm.la_party,
  tipo text not null references ladm.cl_rrr_type,
  fracao numeric(9,6),
  descricao text,
  begin_lifespan_version timestamptz not null default now(),
  end_lifespan_version timestamptz
);
create index on ladm.la_rrr (baunit_id);
create index on ladm.la_rrr (party_id);

-- Fontes documentais (escrituras, matrículas, ofícios, levantamentos) -------------
create table ladm.la_source (
  id bigint generated always as identity primary key,
  tipo text not null,              -- matricula, transcricao, contrato, levantamento, declaracao
  referencia text,
  data_documento date,
  arquivo_uri text,
  sha256 text
);
create table ladm.la_rrr_source (
  rrr_id bigint references ladm.la_rrr on delete cascade,
  source_id bigint references ladm.la_source on delete cascade,
  primary key (rrr_id, source_id)
);

-- Unidades espaciais ---------------------------------------------------------------
create table ladm.la_spatialunit (
  id bigint generated always as identity primary key,
  projeto_id bigint,               -- fk adicionada em 003_reurb.sql
  nivel text not null references ladm.cl_spatialunit_level,
  parent_id bigint references ladm.la_spatialunit,    -- lote → quadra → núcleo
  baunit_id bigint references ladm.la_baunit,
  codigo text not null,            -- ex.: Q03-L12
  rotulo text,
  endereco text,
  geom geometry(MultiPolygon, 4674) not null,
  area_m2 numeric(14,2),           -- calculada no UTM do projeto (trigger em 003)
  perimetro_m numeric(14,2),
  begin_lifespan_version timestamptz not null default now(),
  end_lifespan_version timestamptz,
  constraint geom_valida check (ST_IsValid(geom))
);
create index la_spatialunit_geom on ladm.la_spatialunit using gist (geom);
create index on ladm.la_spatialunit (projeto_id, nivel);
create unique index la_spatialunit_codigo_vigente on ladm.la_spatialunit (projeto_id, nivel, codigo) where end_lifespan_version is null;

-- Vértices (LA_Point) com qualidade posicional ------------------------------------
create table ladm.la_point (
  id bigint generated always as identity primary key,
  projeto_id bigint,
  codigo text not null,            -- ex.: ABCD-M-0001 (padrão de codificação do credenciado)
  tipo text not null references ladm.cl_point_type,
  metodo text not null references ladm.cl_point_method,
  geom geometry(PointZ, 4674) not null,
  sigma_e numeric(6,3),            -- desvio-padrão em metros (E, N, h)
  sigma_n numeric(6,3),
  sigma_h numeric(6,3),
  levantamento_id bigint,          -- fk em 003 (campo.levantamento)
  medido_em timestamptz,
  observacao text
);
create index la_point_geom on ladm.la_point using gist (geom);
create unique index on ladm.la_point (projeto_id, codigo);

-- Ordem dos vértices em cada unidade espacial (anel externo, sentido horário)
create table ladm.la_spatialunit_point (
  spatialunit_id bigint references ladm.la_spatialunit on delete cascade,
  ordem int not null,
  point_id bigint not null references ladm.la_point,
  primary key (spatialunit_id, ordem)
);
