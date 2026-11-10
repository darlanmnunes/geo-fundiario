-- Inteligência territorial: catálogo de fontes, camadas locais e dossiês por área.
create schema if not exists inteligencia;
comment on schema inteligencia is 'Cruzamento de uma área com camadas públicas (hidrografia, risco, censo, zoneamento, CAR, SIGEF, UC/TI…) gerando achados com base legal';

create table inteligencia.fonte (
  codigo text primary key,
  nome text not null,
  orgao text,
  url text,
  tipo text not null check (tipo in ('wfs','wms','arquivo','api','tabela_local')),
  licenca text,
  atualizada_em date
);

create table inteligencia.camada (
  codigo text primary key,
  fonte_codigo text references inteligencia.fonte,
  nome text not null,
  base_legal text,
  tabela_local regclass,                 -- quando a camada está carregada no banco
  parametros jsonb not null default '{}'::jsonb   -- ex.: faixa de APP em metros
);

insert into inteligencia.fonte values
  ('ibge_censo', 'Censo Demográfico 2022 — agregados por setor', 'IBGE', 'https://www.ibge.gov.br', 'arquivo', 'aberta', null),
  ('ana_bho', 'Base Hidrográfica Ottocodificada', 'ANA', 'https://metadados.snirh.gov.br', 'wfs', 'aberta', null),
  ('sgb_risco', 'Setorização de áreas de risco', 'SGB/CPRM', 'https://geoportal.sgb.gov.br', 'wfs', 'aberta', null),
  ('sicar', 'Cadastro Ambiental Rural', 'SFB', 'https://www.car.gov.br', 'arquivo', 'aberta', null),
  ('sigef', 'Parcelas certificadas', 'INCRA', 'https://sigef.incra.gov.br', 'arquivo', 'aberta', null),
  ('icmbio_uc', 'Unidades de conservação', 'ICMBio/MMA', 'https://dados.gov.br', 'wfs', 'aberta', null),
  ('funai_ti', 'Terras indígenas', 'FUNAI', 'https://geoserver.funai.gov.br', 'wfs', 'aberta', null),
  ('iphan', 'Cadastro Nacional de Sítios Arqueológicos', 'IPHAN', 'https://portal.iphan.gov.br', 'api', 'aberta', null),
  ('municipio', 'Zoneamento, perímetro urbano e cadastro imobiliário', 'Município', null, 'tabela_local', 'conforme convênio', null),
  ('cri', 'Matrículas e poligonais do SIG-RI', 'Registro de Imóveis / ONR', null, 'api', 'restrita', null),
  ('mde', 'Modelo digital de elevação', 'Copernicus / NASA', null, 'arquivo', 'aberta', null);

create table inteligencia.dossie (
  id bigint generated always as identity primary key,
  projeto_id bigint references reurb.projeto on delete cascade,
  nome text not null,
  geom geometry(MultiPolygon, 4674) not null,
  srid_utm int not null default 31983,
  gerado_em timestamptz not null default now(),
  resumo text,
  pontuacao int check (pontuacao between 0 and 100)
);
create index dossie_geom on inteligencia.dossie using gist (geom);

create table inteligencia.achado (
  id bigint generated always as identity primary key,
  dossie_id bigint not null references inteligencia.dossie on delete cascade,
  camada_codigo text references inteligencia.camada,
  camada_nome text not null,
  severidade text not null check (severidade in ('impede','condiciona','atencao','ok','sem_dado')),
  resultado text not null,
  implicacao text,
  base_legal text,
  metricas jsonb not null default '{}'::jsonb,   -- área sobreposta, distância mínima, percentuais…
  geom geometry(Geometry, 4674)                  -- recorte da interseção, quando houver
);
create index on inteligencia.achado (dossie_id);

-- Exemplo de análise local: distância do perímetro à hidrografia carregada no banco.
-- (A tabela de hidrografia é carregada por projeto; aqui só a função.)
create or replace function inteligencia.fn_distancia_hidrografia(p_geom geometry, p_tabela regclass, p_srid int default 31983)
returns numeric language plpgsql stable as $$
declare d numeric;
begin
  execute format('select min(ST_Distance(ST_Transform($1, %s), ST_Transform(geom, %s))) from %s', p_srid, p_srid, p_tabela)
    into d using p_geom;
  return round(d, 2);
end $$;
