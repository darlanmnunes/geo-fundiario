-- Logradouros (eixos) — usados para nomear confrontações com o sistema viário nos memoriais.
create table reurb.logradouro (
  id bigint generated always as identity primary key,
  projeto_id bigint not null references reurb.projeto on delete cascade,
  nome text not null,
  geom geometry(LineString, 4674) not null
);
create index logradouro_geom on reurb.logradouro using gist (geom);
