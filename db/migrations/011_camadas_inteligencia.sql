-- Catálogo das camadas cruzadas pela inteligência territorial. Estava só no código da interface.
insert into inteligencia.fonte values
  ('imagens_historicas', 'Imagens orbitais e ortofotos históricas', 'INPE / ESA / município', 'https://www.dgi.inpe.br/catalogo/', 'arquivo', 'aberta', null),
  ('osm', 'OpenStreetMap', 'Colaboradores do OpenStreetMap', 'https://www.openstreetmap.org', 'arquivo', 'ODbL 1.0', null),
  ('concessionarias', 'Redes de água, esgoto, energia e drenagem', 'Concessionárias / SNIS', null, 'arquivo', 'conforme convênio', null)
on conflict (codigo) do nothing;

alter table inteligencia.camada add column ordem int;
alter table inteligencia.camada add column fontes_descricao text;

insert into inteligencia.camada (codigo, fonte_codigo, nome, base_legal, ordem, fontes_descricao, parametros) values
  ('marco_temporal',  'imagens_historicas', 'Marco temporal (ocupação até 22/12/2016)', 'Lei 13.465/2017, art. 9º, §2º', 10,
   'Imagens históricas (Landsat/Sentinel, ortofotos municipais)', '{}'),
  ('hidrografia_app', 'ana_bho', 'Hidrografia e APP', 'Lei 12.651/2012, arts. 4º, 64 e 65', 20,
   'ANA (BHO), IBGE, OpenStreetMap, IDE municipal', '{"faixa_m": 30}'),
  ('risco',           'sgb_risco', 'Risco geológico e hidrológico', 'Lei 13.465/2017, art. 39', 30,
   'SGB/CPRM (setorização de risco), CEMADEN, Defesa Civil', '{}'),
  ('declividade',     'mde', 'Declividade', 'Lei 6.766/1979, art. 3º, III', 40,
   'MDE (Copernicus 30 m / SRTM) ou levantamento próprio', '{"limite_pct": 30}'),
  ('setor_censitario','ibge_censo', 'Setor censitário', 'Dec. 9.310/2018, art. 6º (renda)', 50,
   'IBGE, Censo 2022 (agregados por setor)', '{}'),
  ('zoneamento',      'municipio', 'Zoneamento e ZEIS', 'Lei 10.257/2001, art. 4º', 60,
   'Plano Diretor e lei de uso do solo do município', '{}'),
  ('matriculas',      'cri', 'Matrículas atingidas', 'Lei 13.465/2017, art. 31; art. 35, II', 70,
   'Registro de Imóveis (SIG-RI / ONR)', '{}'),
  ('car',             'sicar', 'Cadastro Ambiental Rural', 'Lei 12.651/2012, art. 29', 80, 'SICAR', '{}'),
  ('sigef',           'sigef', 'Imóveis rurais certificados', 'Lei 6.015/1973, art. 176, §3º', 90, 'SIGEF / INCRA', '{}'),
  ('uc_ti',           'icmbio_uc', 'Unidades de conservação e terras indígenas', 'Lei 9.985/2000', 100,
   'ICMBio, FUNAI, órgão estadual', '{}'),
  ('infraestrutura',  'concessionarias', 'Infraestrutura essencial', 'Lei 13.465/2017, art. 36, §1º', 110,
   'Concessionárias, SNIS, cadastro municipal', '{}'),
  ('patrimonio',      'iphan', 'Bens tombados e sítios arqueológicos', 'Dec.-Lei 25/1937', 120,
   'IPHAN (CNSA), órgão estadual', '{}');

-- Um achado pode ter sido calculado sobre geometria real ou só ilustrar o formato do dossiê.
alter table inteligencia.achado add column origem text not null default 'calculado'
  check (origem in ('calculado','simulado','informado'));

create or replace view consulta.achado_territorial as
select d.projeto_id as nucleo_id, a.camada_nome as camada, a.severidade, a.resultado, a.implicacao, a.base_legal, a.origem
  from inteligencia.achado a join inteligencia.dossie d on d.id = a.dossie_id;
