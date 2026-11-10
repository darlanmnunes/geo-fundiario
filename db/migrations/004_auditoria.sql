-- Trilha de auditoria genérica: toda alteração em tabelas cadastrais fica registrada.
create table auditoria.evento (
  id bigint generated always as identity primary key,
  tabela text not null,
  operacao text not null,
  registro_id text,                 -- bigint ou uuid, conforme a tabela
  antes jsonb,
  depois jsonb,
  usuario text not null default current_user,
  ocorrido_em timestamptz not null default now()
);
create index on auditoria.evento (tabela, registro_id);

create or replace function auditoria.fn_registra() returns trigger language plpgsql as $$
begin
  insert into auditoria.evento (tabela, operacao, registro_id, antes, depois)
  values (tg_table_schema || '.' || tg_table_name, tg_op,
          coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id'),
          case when tg_op <> 'INSERT' then to_jsonb(old) - 'geom' end,
          case when tg_op <> 'DELETE' then to_jsonb(new) - 'geom' end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['ladm.la_party','ladm.la_baunit','ladm.la_rrr','ladm.la_spatialunit',
                           'reurb.projeto','reurb.peca','reurb.notificacao','campo.cadastro_social']
  loop
    execute format('create trigger trg_auditoria after insert or update or delete on %s
                    for each row execute function auditoria.fn_registra()', t);
  end loop;
end $$;
