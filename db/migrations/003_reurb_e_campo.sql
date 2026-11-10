-- Processo REURB (Lei 13.465/2017; Decreto 9.310/2018) e levantamento de campo.

-- Projeto ----------------------------------------------------------------------------
create table reurb.projeto (
  id bigint generated always as identity primary key,
  nome text not null,                         -- nome do núcleo urbano informal
  processo_adm text,                          -- nº do processo administrativo municipal
  modalidade text check (modalidade in ('reurb_s','reurb_e','mista')),   -- art. 13
  legitimado text not null,                   -- art. 14 (município, ocupantes, associação, DP, MP…)
  municipio_ibge char(7) not null,
  municipio_nome text not null,
  ocupacao_ate_marco_temporal boolean, -- núcleo consolidado até 22/12/2016 (art. 9º, §2º)
  uf char(2) not null,
  srid_utm int not null default 31983,        -- SIRGAS 2000 / UTM do núcleo
  cri_cns text,                               -- cartório de registro de imóveis competente
  responsavel_tecnico text,
  art_rrt text,
  situacao text not null default 'em_andamento' check (situacao in ('em_andamento','suspenso','concluido','arquivado')),
  criado_em timestamptz not null default now()
);

alter table ladm.la_spatialunit add constraint la_spatialunit_projeto_fk foreign key (projeto_id) references reurb.projeto on delete cascade;
alter table ladm.la_point add constraint la_point_projeto_fk foreign key (projeto_id) references reurb.projeto on delete cascade;

-- Fases (catálogo) — art. 28 + etapas técnicas que o sistema também controla ----------
create table reurb.fase (
  codigo text primary key,
  ordem int not null unique,
  nome text not null,
  tipo text not null check (tipo in ('legal','tecnica')),
  base_legal text,
  prazo_dias int,                              -- prazo legal ou de referência
  descricao text
);
insert into reurb.fase values
  ('diagnostico',    10, 'Diagnóstico e planejamento',          'tecnica', null, null,
   'Delimitação preliminar do núcleo, buscas de matrículas, bases cartográficas, plano de campo.'),
  ('requerimento',   20, 'Requerimento e instauração',           'legal', 'Lei 13.465/2017 art. 28, I; art. 14', null,
   'Requerimento do legitimado e instauração do processo administrativo pelo Município.'),
  ('classificacao',  30, 'Classificação da modalidade',           'legal', 'Lei 13.465/2017 art. 13; art. 30, §§2º-3º; Dec. 9.310/2018 arts. 5º, 6º e 23', 180,
   'Município classifica REURB-S/REURB-E; omissão no prazo permite fixação provisória pelo requerente.'),
  ('levantamento',   40, 'Levantamento de campo',                'tecnica', 'Lei 13.465/2017 art. 35, I; Dec. 9.310/2018 arts. 28-29', null,
   'Levantamento planialtimétrico cadastral georreferenciado ao SGB (SIRGAS 2000), erro posicional esférico ≤ 8 cm por vértice de limite, e cadastro socioeconômico.'),
  ('notificacao',    50, 'Buscas e notificações',                'legal', 'Lei 13.465/2017 art. 31; Dec. 9.310/2018 art. 24', 30,
   'Buscas cartoriais e notificação (AR ou edital) de titulares, confrontantes e terceiros; 30 dias para impugnar, silêncio = concordância (art. 31, §6º).'),
  ('projeto',        60, 'Projeto de regularização fundiária',   'legal', 'Lei 13.465/2017 arts. 35-39; art. 28, III; Dec. 9.310/2018 arts. 30-32; Lei 12.651/2012 arts. 64-65', null,
   'Plantas, memoriais, estudos técnicos (ambiental e de risco), projeto urbanístico e cronograma de obras.'),
  ('saneamento',     70, 'Saneamento e resolução de impugnações','legal', 'Lei 13.465/2017 art. 28, IV; arts. 21, 31 §3º e 34; Dec. 9.310/2018 art. 24 §§10-12', null,
   'Análise de impugnações, procedimento extrajudicial de composição de conflitos.'),
  ('aprovacao',      80, 'Decisão e aprovação',                  'legal', 'Lei 13.465/2017 art. 28, V; art. 40', null,
   'Ato formal da autoridade competente aprovando o projeto, com publicidade.'),
  ('crf',            90, 'Emissão da CRF',                       'legal', 'Lei 13.465/2017 art. 28, VI; art. 41; Dec. 9.310/2018 art. 38', null,
   'Certidão de Regularização Fundiária com listagem dos ocupantes e unidades.'),
  ('registro',      100, 'Registro no cartório',                 'legal', 'Lei 13.465/2017 art. 28, VII; arts. 42-54; Dec. 9.310/2018 arts. 40 e 42; Prov. CNJ 149/2023 art. 440-AQ', 60,
   'Registro da CRF e do projeto; 15 dias para nota de exigência e 60 dias para concluir; matrículas individuais com descrição georreferenciada.');

create table reurb.projeto_fase (
  projeto_id bigint references reurb.projeto on delete cascade,
  fase_codigo text references reurb.fase,
  situacao text not null default 'pendente' check (situacao in ('pendente','em_andamento','concluida','bloqueada')),
  iniciada_em date,
  prazo_em date,                -- calculado de prazo_dias quando aplicável
  concluida_em date,
  observacao text,
  primary key (projeto_id, fase_codigo)
);

-- Peças técnicas e documentos produzidos ---------------------------------------------
create table reurb.tipo_peca (
  codigo text primary key,
  nome text not null,
  base_legal text,
  exige_art_rrt boolean not null default false,
  escopo text not null check (escopo in ('projeto','lote','pessoa'))
);
insert into reurb.tipo_peca values
  ('levantamento_planialtimetrico', 'Levantamento planialtimétrico cadastral georreferenciado', 'art. 35, I', true,  'projeto'),
  ('planta_perimetro',              'Planta do perímetro do núcleo com matrículas atingidas',   'art. 35, II', true, 'projeto'),
  ('estudo_preliminar',             'Estudo preliminar das desconformidades e situação jurídica, urbanística e ambiental', 'art. 35, III', true, 'projeto'),
  ('projeto_urbanistico',           'Projeto urbanístico',                                     'art. 35, IV; art. 36', true, 'projeto'),
  ('memorial_perimetro',            'Memorial descritivo do perímetro',                        'art. 35, V', true,  'projeto'),
  ('memorial_lote',                 'Memorial descritivo da unidade',                          'art. 35, V', true,  'lote'),
  ('estudo_risco',                  'Estudo técnico para situação de risco',                   'art. 35, VII; art. 39', true, 'projeto'),
  ('estudo_ambiental',              'Estudo técnico ambiental',                                'art. 35, VIII; arts. 11-12', true, 'projeto'),
  ('cronograma_obras',              'Cronograma físico de obras de infraestrutura essencial',  'art. 35, IX', false, 'projeto'),
  ('termo_compromisso',             'Termo de compromisso de execução do cronograma',          'art. 35, X', false, 'projeto'),
  ('notificacao',                   'Notificação de titular/confrontante',                     'art. 31', false, 'pessoa'),
  ('edital',                        'Edital de notificação',                                   'art. 31, §§3º-4º', false, 'projeto'),
  ('cadastro_socioeconomico',       'Ficha de cadastro socioeconômico',                        'art. 13; Dec. 9.310/2018', false, 'pessoa'),
  ('listagem_ocupantes',            'Listagem de ocupantes',                                   'art. 41, VI', false, 'projeto'),
  ('crf',                           'Certidão de Regularização Fundiária (CRF)',               'art. 41', false, 'projeto'),
  ('titulo_legitimacao_fundiaria',  'Título de legitimação fundiária',                         'art. 23', false, 'lote'),
  ('titulo_legitimacao_posse',      'Título de legitimação de posse',                          'arts. 25-27', false, 'lote');

create table reurb.peca (
  id bigint generated always as identity primary key,
  projeto_id bigint not null references reurb.projeto on delete cascade,
  tipo text not null references reurb.tipo_peca,
  spatialunit_id bigint references ladm.la_spatialunit,
  party_id bigint references ladm.la_party,
  versao int not null default 1,
  situacao text not null default 'rascunho' check (situacao in ('rascunho','em_revisao','aprovada','assinada','substituida')),
  arquivo_uri text,
  sha256 text,                       -- verificação pública de integridade
  responsavel_tecnico text,
  art_rrt text,
  gerada_em timestamptz not null default now()
);
create index on reurb.peca (projeto_id, tipo);

-- Notificações (art. 31) -------------------------------------------------------------
create table reurb.notificacao (
  id bigint generated always as identity primary key,
  projeto_id bigint not null references reurb.projeto on delete cascade,
  party_id bigint references ladm.la_party,
  destinatario_nome text not null,
  papel text not null check (papel in ('titular_dominio','confrontante','terceiro_interessado','ente_publico')),
  meio text not null check (meio in ('pessoal','correio_ar','edital','eletronico')),
  enviada_em date,
  recebida_em date,                  -- data do AR / ciência
  prazo_fim date generated always as (recebida_em + 30) stored,
  resposta text check (resposta in ('sem_manifestacao','anuencia','impugnacao')),
  impugnacao_resumo text
);

-- Levantamento de campo -------------------------------------------------------------
create table campo.levantamento (
  id bigint generated always as identity primary key,
  projeto_id bigint not null references reurb.projeto on delete cascade,
  tipo text not null check (tipo in ('topografico','gnss','aerofotogrametrico','cadastro_social')),
  equipamento text,
  sistema_referencia text not null default 'SIRGAS 2000',
  data_inicio date,
  data_fim date,
  responsavel text,
  art_rrt text,
  norma text,                        -- ex.: ABNT NBR 13133:2021, NBR 17047:2022
  metadados jsonb not null default '{}'::jsonb
);
alter table ladm.la_point add constraint la_point_levantamento_fk foreign key (levantamento_id) references campo.levantamento;

create table campo.cadastro_social (
  id bigint generated always as identity primary key,
  projeto_id bigint not null references reurb.projeto on delete cascade,
  spatialunit_id bigint references ladm.la_spatialunit,
  party_id bigint references ladm.la_party,             -- responsável familiar
  composicao_familiar int,
  renda_familiar numeric(12,2),
  tempo_ocupacao_anos numeric(5,1),
  uso_imovel text check (uso_imovel in ('residencial','comercial','misto','institucional','vazio')),
  possui_outro_imovel boolean,       -- proprietário EXCLUSIVO de outro imóvel: veda legitimação fundiária na REURB-S (art. 23, §1º, I)
  ja_beneficiado_reurb boolean,       -- art. 23, §1º, II
  pcd boolean,
  escolaridade text,
  coletado_em timestamptz,
  coletado_por text,
  localizacao geometry(Point, 4674),
  fotos jsonb not null default '[]'::jsonb,
  respostas jsonb not null default '{}'::jsonb          -- questionário extensível
);

-- Área/perímetro calculados no UTM do projeto ----------------------------------------
create or replace function ladm.fn_calcula_metricas() returns trigger language plpgsql as $$
declare v_srid int;
begin
  select srid_utm into v_srid from reurb.projeto where id = new.projeto_id;
  v_srid := coalesce(v_srid, 31983);
  new.area_m2 := round(ST_Area(ST_Transform(new.geom, v_srid))::numeric, 2);
  new.perimetro_m := round(ST_Perimeter(ST_Transform(new.geom, v_srid))::numeric, 2);
  return new;
end $$;
create trigger trg_spatialunit_metricas before insert or update of geom on ladm.la_spatialunit
  for each row execute function ladm.fn_calcula_metricas();

-- Confrontantes por topologia (lotes vigentes que compartilham divisa) ---------------
create or replace function ladm.fn_confrontantes(p_spatialunit bigint)
returns table (spatialunit_id bigint, codigo text, nivel text, extensao_divisa_m numeric)
language sql stable as $$
  with alvo as (
    select su.geom, su.projeto_id, coalesce(p.srid_utm, 31983) srid
    from ladm.la_spatialunit su left join reurb.projeto p on p.id = su.projeto_id
    where su.id = p_spatialunit
  )
  select o.id, o.codigo, o.nivel,
         round(ST_Length(ST_Transform(ST_Intersection(ST_Boundary(a.geom), ST_Boundary(o.geom)), a.srid))::numeric, 2)
  from alvo a
  join ladm.la_spatialunit o
    on o.projeto_id = a.projeto_id and o.id <> p_spatialunit
   and o.end_lifespan_version is null
   and o.nivel in ('lote','area_publica')
   and ST_Intersects(ST_Buffer(a.geom::geography, 0.05)::geometry, o.geom)
  where ST_Length(ST_Transform(ST_Intersection(ST_Boundary(a.geom), ST_Boundary(o.geom)), a.srid)) > 0.05
  order by 4 desc;
$$;

-- Precisão posicional (Dec. 9.310/2018 art. 29, §3º): erro esférico ≤ 0,08 m por vértice de limite.
create or replace view ladm.vw_qualidade_vertice as
select p.id, p.projeto_id, p.codigo, p.tipo, p.metodo,
       round(sqrt(coalesce(p.sigma_e,0)^2 + coalesce(p.sigma_n,0)^2 + coalesce(p.sigma_h,0)^2)::numeric, 3) as erro_esferico_m,
       sqrt(coalesce(p.sigma_e,0)^2 + coalesce(p.sigma_n,0)^2 + coalesce(p.sigma_h,0)^2) <= 0.08 as atende_dec_9310
from ladm.la_point p;
