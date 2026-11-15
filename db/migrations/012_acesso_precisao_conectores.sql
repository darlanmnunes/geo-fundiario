-- 1) Acesso: usuários com perfil, para inserir e corrigir dados pelo navegador.
-- 2) Precisão posicional: a tolerância e a componente avaliada passam a ser da NORMA aplicada ao projeto.
-- 3) Plano de cálculo de áreas e distâncias: UTM ou Sistema Geodésico Local, por projeto.
-- 4) Conectores do diagnóstico territorial: de onde cada tema é consultado em tempo real.

create schema if not exists acesso;
comment on schema acesso is 'Usuários, perfis e sessões da plataforma';

create table acesso.usuario (
  id bigint generated always as identity primary key,
  nome text not null,
  email text not null,
  senha_hash text not null,                 -- scrypt: "scrypt$N$r$p$sal$hash" (nunca a senha)
  perfil text not null check (perfil in ('administrador','editor','leitor')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por text,
  ultimo_acesso timestamptz
);
create unique index usuario_email on acesso.usuario (lower(email));
comment on column acesso.usuario.perfil is 'administrador: gerencia usuários e tudo o mais; editor: insere e corrige dados e documentos; leitor: só consulta';

create table acesso.sessao (
  token_sha256 char(64) primary key,        -- o token só existe no navegador de quem entrou
  usuario_id bigint not null references acesso.usuario on delete cascade,
  criada_em timestamptz not null default now(),
  expira_em timestamptz not null,
  ip text
);
create index on acesso.sessao (usuario_id);

grant usage on schema acesso to geof_api;
grant select, insert, update on acesso.usuario to geof_api;
grant select, insert, delete on acesso.sessao to geof_api;
grant usage, select on all sequences in schema acesso to geof_api;

-- A auditoria passa a registrar a PESSOA que fez a alteração (definida pela API a cada transação),
-- e não só o usuário de conexão do banco.
alter table auditoria.evento alter column usuario drop default;
create or replace function auditoria.fn_registra() returns trigger language plpgsql security definer
set search_path = pg_catalog, auditoria as $$
begin
  insert into auditoria.evento (tabela, operacao, registro_id, antes, depois, usuario)
  values (tg_table_schema || '.' || tg_table_name, tg_op,
          coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id'),
          case when tg_op <> 'INSERT' then to_jsonb(old) - 'geom' end,
          case when tg_op <> 'DELETE' then to_jsonb(new) - 'geom' end,
          coalesce(nullif(current_setting('geof.usuario', true), ''), session_user));
  return coalesce(new, old);
end $$;

-- Normas de precisão posicional. O limite NÃO é sempre 8 cm: depende do tipo de imóvel e de limite.
create table ladm.cl_norma_precisao (
  code text primary key,
  descricao text not null,
  base_legal text not null,
  tolerancia_m numeric(6,3) not null,
  componente text not null check (componente in ('tridimensional','planimetrica')),
  aplicacao text not null
);
insert into ladm.cl_norma_precisao values
  ('reurb_dec9310', 'REURB: vértice definidor de limite', 'Dec. 9.310/2018, art. 29, §3º', 0.08, 'tridimensional',
   'Regularização fundiária urbana. O decreto chama de "erro posicional esférico"; o Município pode exigir valor menor (§4º).'),
  ('rural_limite_artificial', 'Imóvel rural: limite artificial', 'Lei 10.267/2001; Norma Técnica para Georreferenciamento de Imóveis Rurais (INCRA), 3ª ed.', 0.50, 'planimetrica',
   'Cercas, muros, estradas, valas e demais limites artificiais.'),
  ('rural_limite_natural', 'Imóvel rural: limite natural', 'Norma Técnica para Georreferenciamento de Imóveis Rurais (INCRA), 3ª ed.', 3.00, 'planimetrica',
   'Corpos d''água, cristas, linhas de cumeada e demais limites naturais.'),
  ('rural_limite_inacessivel', 'Imóvel rural: limite inacessível', 'Norma Técnica para Georreferenciamento de Imóveis Rurais (INCRA), 3ª ed.', 7.50, 'planimetrica',
   'Vértices sem acesso, determinados por método indireto.');

alter table reurb.projeto
  add column norma_precisao text not null default 'reurb_dec9310' references ladm.cl_norma_precisao,
  add column tolerancia_posicional_m numeric(6,3),   -- só quando o Município fixa valor mais rígido que o da norma
  add column plano_calculo text not null default 'utm' check (plano_calculo in ('utm','sgl'));
comment on column reurb.projeto.plano_calculo is
  'Plano em que áreas, distâncias e azimutes das peças são calculados: utm = plano de projeção UTM; sgl = Sistema Geodésico Local (plano topográfico local, NBR 14166 / NBR 17047)';

create view ladm.vw_conformidade_vertice as
select p.id, p.projeto_id, p.codigo, p.tipo, p.metodo, n.code as norma, n.base_legal, n.componente,
       coalesce(pr.tolerancia_posicional_m, n.tolerancia_m) as tolerancia_m,
       round(case n.componente
               when 'tridimensional' then sqrt(coalesce(p.sigma_e,0)^2 + coalesce(p.sigma_n,0)^2 + coalesce(p.sigma_h,0)^2)
               else sqrt(coalesce(p.sigma_e,0)^2 + coalesce(p.sigma_n,0)^2) end::numeric, 3) as erro_m,
       case n.componente
         when 'tridimensional' then sqrt(coalesce(p.sigma_e,0)^2 + coalesce(p.sigma_n,0)^2 + coalesce(p.sigma_h,0)^2)
         else sqrt(coalesce(p.sigma_e,0)^2 + coalesce(p.sigma_n,0)^2) end
         <= coalesce(pr.tolerancia_posicional_m, n.tolerancia_m) as atende
  from ladm.la_point p
  join reurb.projeto pr on pr.id = p.projeto_id
  join ladm.cl_norma_precisao n on n.code = pr.norma_precisao;
grant select on ladm.vw_conformidade_vertice, ladm.cl_norma_precisao to geof_api, geof_leitura;

drop view consulta.qualidade_vertice;
create view consulta.qualidade_vertice as
select projeto_id as nucleo_id, codigo, tipo, metodo, norma, componente, erro_m, tolerancia_m, atende
  from ladm.vw_conformidade_vertice;
grant select on consulta.qualidade_vertice to geof_consulta, geof_leitura, geof_api;

-- Conectores: como cada tema do diagnóstico territorial é obtido.
-- Os endereços dos conectores 'previsto' são o ponto de partida conhecido de cada órgão e devem ser
-- conferidos (camada, versão do serviço, termos de uso) quando o conector for implementado.
alter table inteligencia.camada
  add column conector text,           -- identificador do conector na API (services/api/.../diagnostico.py)
  add column endpoint text,           -- serviço consultado
  add column situacao_conector text not null default 'previsto' check (situacao_conector in ('ao_vivo','previsto'));
update inteligencia.camada set conector = 'osm_hidrografia', endpoint = 'https://overpass-api.de/api/interpreter', situacao_conector = 'ao_vivo' where codigo = 'hidrografia_app';
update inteligencia.camada set conector = 'ibge_malha_setores', endpoint = 'https://servicodados.ibge.gov.br/api/v3/malhas' where codigo = 'setor_censitario';
update inteligencia.camada set conector = 'sgb_wfs_risco', endpoint = 'https://geoportal.sgb.gov.br' where codigo = 'risco';
update inteligencia.camada set conector = 'sicar_wfs', endpoint = 'https://geoserver.car.gov.br/geoserver/sicar/wfs' where codigo = 'car';
update inteligencia.camada set conector = 'sigef_wfs', endpoint = 'https://acervofundiario.incra.gov.br/i3geo/ogc.php' where codigo = 'sigef';
update inteligencia.camada set conector = 'icmbio_funai_wfs', endpoint = 'https://geoserver.funai.gov.br/geoserver/Funai/ows' where codigo = 'uc_ti';
update inteligencia.camada set conector = 'iphan_wfs', endpoint = 'http://portal.iphan.gov.br/geoserver/SICG/ows' where codigo = 'patrimonio';
update inteligencia.camada set conector = 'mde_copernicus', endpoint = 'https://copernicus-dem-30m.s3.amazonaws.com' where codigo = 'declividade';
update inteligencia.camada set conector = 'imagens_stac', endpoint = 'https://data.inpe.br/bdc/stac/v1' where codigo = 'marco_temporal';
update inteligencia.camada set conector = 'municipio_local' where codigo in ('zoneamento', 'infraestrutura');
update inteligencia.camada set conector = 'onr_sigri' where codigo = 'matriculas';
