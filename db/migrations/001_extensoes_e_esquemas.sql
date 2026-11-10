-- Geo-Fundiário — extensões e esquemas
-- Convenção de SRID:
--   * geometrias canônicas em SIRGAS 2000 geográfico (EPSG:4674);
--   * cálculos métricos (área, azimute, distância) via ST_Transform para o UTM
--     SIRGAS 2000 do projeto (ex.: 31983 = fuso 23S), guardado em reurb.projeto.srid_utm.

create extension if not exists postgis;
create extension if not exists ltree;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

create schema if not exists ladm;      -- núcleo cadastral (ISO 19152)
create schema if not exists reurb;     -- processo de regularização (Lei 13.465/2017)
create schema if not exists campo;     -- levantamento de campo (topografia/GNSS, cadastro social)
create schema if not exists auditoria; -- trilha de alterações

comment on schema ladm is 'Land Administration Domain Model (ISO 19152) — pessoas, unidades, direitos e unidades espaciais';
comment on schema reurb is 'Projetos e fases da Regularização Fundiária Urbana (Lei 13.465/2017, Decreto 9.310/2018)';
comment on schema campo is 'Campanhas de levantamento, vértices medidos e cadastro socioeconômico em campo';
