-- Situação de cada unidade no processo, pendências e perfil do responsável familiar.
-- Até aqui esses dados só existiam no arquivo de demonstração da interface; passam a morar no banco,
-- que é a única fonte: a interface lê um instantâneo exportado daqui (ou a API, ao vivo).
--
-- Encaixe no LADM (ISO 19152): situação e pendência são atributos do PROCESSO de regularização sobre
-- uma LA_SpatialUnit, por isso ficam no esquema do módulo (reurb) e apenas referenciam o núcleo cadastral.

create table reurb.cl_situacao_unidade (
  code text primary key,
  ordem int not null unique,
  descricao text not null
);
insert into reurb.cl_situacao_unidade values
  ('levantado',  10, 'Limites medidos em campo; sem cadastro social'),
  ('cadastrado', 20, 'Cadastro socioeconômico concluído'),
  ('notificado', 30, 'Titulares e confrontantes notificados (art. 31)'),
  ('pendencia',  40, 'Há pendência documental, técnica, ambiental ou jurídica em aberto'),
  ('apto_crf',   50, 'Sem pendências; pode constar da CRF (art. 41)');

-- Versionada como o resto do cadastro: muda-se a situação fechando a versão vigente e abrindo outra.
create table reurb.unidade_situacao (
  id bigint generated always as identity primary key,
  spatialunit_id bigint not null references ladm.la_spatialunit on delete cascade,
  situacao text not null references reurb.cl_situacao_unidade,
  observacao text,
  begin_lifespan_version timestamptz not null default now(),
  end_lifespan_version timestamptz
);
create unique index unidade_situacao_vigente on reurb.unidade_situacao (spatialunit_id) where end_lifespan_version is null;

create table reurb.pendencia (
  id bigint generated always as identity primary key,
  projeto_id bigint not null references reurb.projeto on delete cascade,
  spatialunit_id bigint references ladm.la_spatialunit on delete cascade,
  party_id bigint references ladm.la_party,
  origem text not null check (origem in ('documental','ambiental','juridica','tecnica','social')),
  descricao text not null,
  base_legal text,
  aberta_em date not null default current_date,
  resolvida_em date,
  resolucao text
);
create index on reurb.pendencia (projeto_id) where resolvida_em is null;
create index on reurb.pendencia (spatialunit_id);

alter table campo.cadastro_social
  add column situacao_profissional text
    check (situacao_profissional in ('autonomo','clt','aposentado','desempregado','informal','servidor'));

-- Corpos d'água de referência por projeto (APP e faixas não edificáveis: Lei 12.651/2012, arts. 4º, 64 e 65).
create table reurb.hidrografia (
  id bigint generated always as identity primary key,
  projeto_id bigint not null references reurb.projeto on delete cascade,
  nome text,
  fonte text,
  geom geometry(Geometry, 4674) not null
);
create index hidrografia_geom on reurb.hidrografia using gist (geom);

-- O Dec. 9.310/2018 (art. 29, §3º) chama de "erro posicional esférico" a resultante das três componentes
-- (E, N, h). O nome corrente na área é erro posicional tridimensional; a visão passa a expor os dois nomes
-- e também a resultante planimétrica.
create or replace view ladm.vw_qualidade_vertice as
select p.id, p.projeto_id, p.codigo, p.tipo, p.metodo,
       round(sqrt(coalesce(p.sigma_e,0)^2 + coalesce(p.sigma_n,0)^2 + coalesce(p.sigma_h,0)^2)::numeric, 3) as erro_esferico_m,
       sqrt(coalesce(p.sigma_e,0)^2 + coalesce(p.sigma_n,0)^2 + coalesce(p.sigma_h,0)^2) <= 0.08 as atende_dec_9310,
       round(sqrt(coalesce(p.sigma_e,0)^2 + coalesce(p.sigma_n,0)^2 + coalesce(p.sigma_h,0)^2)::numeric, 3) as erro_posicional_3d_m,
       round(sqrt(coalesce(p.sigma_e,0)^2 + coalesce(p.sigma_n,0)^2)::numeric, 3) as erro_planimetrico_m
  from ladm.la_point p;

do $$
declare t text;
begin
  foreach t in array array['reurb.unidade_situacao','reurb.pendencia']
  loop
    execute format('create trigger trg_auditoria after insert or update or delete on %s
                    for each row execute function auditoria.fn_registra()', t);
  end loop;
end $$;
