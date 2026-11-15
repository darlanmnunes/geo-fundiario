-- Camada de proteção do banco: privilégio mínimo, dados pessoais isolados e auditoria inviolável.
--
-- Três papéis sem login. O usuário de conexão de cada serviço recebe UM deles (grant geof_api to <usuario>):
--   geof_api       API da plataforma: lê e grava o cadastro; não apaga (o modelo é versionado) nem altera a auditoria.
--   geof_leitura   painéis e relatórios: só leitura, inclusive de dados pessoais. Uso interno.
--   geof_consulta  consultas em linguagem natural e acesso público: enxerga APENAS o esquema "consulta",
--                  feito de visões sem nome, CPF, contato ou documento de ninguém.
-- Quem aplica as migrações (dono das tabelas) não é afetado.

do $$
declare r text;
begin
  foreach r in array array['geof_api','geof_leitura','geof_consulta'] loop
    if not exists (select from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;

-- 1. Ninguém entra por "public".
revoke all on schema ladm, reurb, campo, documentos, inteligencia, auditoria from public;
revoke all on all tables in schema ladm, reurb, campo, documentos, inteligencia, auditoria from public;
revoke execute on all functions in schema ladm, reurb, campo, documentos, inteligencia, auditoria from public;

-- 2. API: leitura e escrita, sem DELETE (fecha-se a versão em vez de apagar) e sem TRUNCATE.
grant usage on schema ladm, reurb, campo, documentos, inteligencia to geof_api;
grant select, insert, update on all tables in schema ladm, reurb, campo, documentos, inteligencia to geof_api;
grant usage, select on all sequences in schema ladm, reurb, campo, documentos, inteligencia to geof_api;
grant execute on all functions in schema ladm, reurb, inteligencia to geof_api;
grant delete on documentos.vinculo, ladm.la_spatialunit_point, ladm.la_rrr_source, ladm.la_partymember to geof_api;

-- 3. Leitura interna.
grant usage on schema ladm, reurb, campo, documentos, inteligencia, auditoria to geof_leitura;
grant select on all tables in schema ladm, reurb, campo, documentos, inteligencia, auditoria to geof_leitura;
grant execute on all functions in schema ladm, inteligencia to geof_leitura;

-- 4. Auditoria só cresce: o gatilho grava com os privilégios do dono; nenhum papel de serviço altera ou apaga.
alter function auditoria.fn_registra() security definer;
alter function auditoria.fn_registra() set search_path = pg_catalog, auditoria;
grant usage on schema auditoria to geof_api;
grant select on auditoria.evento to geof_api;

create or replace function auditoria.fn_imutavel() returns trigger language plpgsql as $$
begin
  raise exception 'auditoria.evento é somente de inclusão';
end $$;
create trigger trg_imutavel before update or delete on auditoria.evento
  for each row execute function auditoria.fn_imutavel();

-- 5. Dados pessoais (LGPD): segurança por linha ligada; só os papéis abaixo têm política.
--    Qualquer outro papel que venha a receber SELECT por engano não lê linha nenhuma.
do $$
declare t text;
begin
  foreach t in array array['ladm.la_party','ladm.la_partymember','campo.cadastro_social',
                           'documentos.documento','documentos.assinatura','reurb.notificacao'] loop
    execute format('alter table %s enable row level security', t);
    execute format('create policy api_total on %s for all to geof_api using (true) with check (true)', t);
    execute format('create policy leitura_interna on %s for select to geof_leitura using (true)', t);
  end loop;
end $$;

-- 6. Esquema de consulta: o que pode ser mostrado a qualquer pessoa e o que um modelo de linguagem pode ler.
create schema if not exists consulta;
comment on schema consulta is 'Visões sem dados pessoais para acesso público, painéis abertos e consultas em linguagem natural';

create view consulta.nucleo as
select p.id as nucleo_id, p.nome, p.modalidade, p.municipio_nome as municipio, p.uf, p.situacao,
       (select f.nome from reurb.projeto_fase pf join reurb.fase f on f.codigo = pf.fase_codigo
         where pf.projeto_id = p.id and pf.situacao = 'em_andamento' order by f.ordem limit 1) as fase_atual,
       (select count(*) from ladm.la_spatialunit su where su.projeto_id = p.id and su.nivel = 'lote' and su.end_lifespan_version is null) as unidades,
       (select count(*) from campo.cadastro_social cs where cs.projeto_id = p.id) as familias,
       (select round(su.area_m2 / 10000, 4) from ladm.la_spatialunit su where su.projeto_id = p.id and su.nivel = 'nucleo' and su.end_lifespan_version is null limit 1) as area_ha
  from reurb.projeto p;

create view consulta.unidade as
select su.id as unidade_id, su.projeto_id as nucleo_id, su.codigo, q.codigo as quadra, su.area_m2, su.perimetro_m,
       us.situacao,
       (select count(*) from reurb.pendencia pd where pd.spatialunit_id = su.id and pd.resolvida_em is null) as pendencias_abertas,
       cs.composicao_familiar, cs.tempo_ocupacao_anos, cs.uso_imovel,
       case when cs.renda_familiar is null then null
            when cs.renda_familiar <= 1518 then 'até 1 SM'
            when cs.renda_familiar <= 3036 then '1 a 2 SM'
            when cs.renda_familiar <= 4554 then '2 a 3 SM'
            when cs.renda_familiar <= 7590 then '3 a 5 SM'
            else 'acima de 5 SM' end as faixa_renda,
       cs.id is not null as ocupante_identificado
  from ladm.la_spatialunit su
  left join ladm.la_spatialunit q on q.id = su.parent_id
  left join reurb.unidade_situacao us on us.spatialunit_id = su.id and us.end_lifespan_version is null
  left join campo.cadastro_social cs on cs.spatialunit_id = su.id
 where su.nivel = 'lote' and su.end_lifespan_version is null;

create view consulta.fase as
select pf.projeto_id as nucleo_id, f.ordem, f.codigo, f.nome, f.tipo, f.base_legal, f.prazo_dias,
       pf.situacao, pf.iniciada_em, pf.prazo_em, pf.concluida_em
  from reurb.projeto_fase pf join reurb.fase f on f.codigo = pf.fase_codigo;

create view consulta.pendencia as
select pd.projeto_id as nucleo_id, su.codigo as unidade, pd.origem, pd.base_legal, pd.aberta_em, pd.resolvida_em,
       -- o texto livre pode citar pessoas; para fora só vai a categoria
       pd.resolvida_em is null as em_aberto
  from reurb.pendencia pd left join ladm.la_spatialunit su on su.id = pd.spatialunit_id;

create view consulta.qualidade_vertice as
select projeto_id as nucleo_id, codigo, tipo, metodo, erro_posicional_3d_m, erro_planimetrico_m, atende_dec_9310
  from ladm.vw_qualidade_vertice;

create view consulta.notificacao as
select projeto_id as nucleo_id, papel, meio, enviada_em, recebida_em, prazo_fim, resposta
  from reurb.notificacao;

create view consulta.peca as
select pc.projeto_id as nucleo_id, tp.nome as peca, tp.base_legal, pc.situacao, pc.versao
  from reurb.peca pc join reurb.tipo_peca tp on tp.codigo = pc.tipo;

create view consulta.achado_territorial as
select d.projeto_id as nucleo_id, a.camada_nome as camada, a.severidade, a.resultado, a.implicacao, a.base_legal
  from inteligencia.achado a join inteligencia.dossie d on d.id = a.dossie_id;

grant usage on schema consulta to geof_consulta, geof_leitura, geof_api;
grant select on all tables in schema consulta to geof_consulta, geof_leitura, geof_api;

-- 7. Freios do papel de consulta: só leitura, tempo curto, sem acumular trabalho.
alter role geof_consulta set default_transaction_read_only = on;
alter role geof_consulta set statement_timeout = '5s';
alter role geof_consulta set idle_in_transaction_session_timeout = '10s';
alter role geof_consulta set search_path = consulta;

-- 8. Objetos criados por migrações futuras herdam as mesmas regras.
alter default privileges in schema ladm, reurb, campo, documentos, inteligencia grant select, insert, update on tables to geof_api;
alter default privileges in schema ladm, reurb, campo, documentos, inteligencia grant usage, select on sequences to geof_api;
alter default privileges in schema ladm, reurb, campo, documentos, inteligencia, auditoria grant select on tables to geof_leitura;
alter default privileges in schema consulta grant select on tables to geof_consulta, geof_leitura, geof_api;
