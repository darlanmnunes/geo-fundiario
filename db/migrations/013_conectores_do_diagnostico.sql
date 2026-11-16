-- Diagnóstico territorial: liga os conectores às fontes oficiais conferidas em novembro de 2026
-- (docs/diagnostico-territorial.md) e prepara o cadastro para o SINTER.

-- 1. Um conector pode não ter previsão de endereço público: registra-se o motivo.
alter table inteligencia.camada add column observacao text;

-- 2. Fontes novas.
insert into inteligencia.fonte (codigo, nome, orgao, url, tipo, licenca) values
  ('ibge_sidra', 'SIDRA - Censo Demográfico 2022', 'IBGE', 'https://apisidra.ibge.gov.br', 'api', 'aberta, com citação da fonte'),
  ('ibge_geo', 'Geosserviços do IBGE', 'IBGE', 'https://geoservicos.ibge.gov.br/geoserver', 'wfs', 'aberta, com citação da fonte'),
  ('incra_territorios', 'Assentamentos e territórios quilombolas', 'INCRA', 'https://cmr.funai.gov.br/geoserver/CMR-PUBLICO/ows', 'wfs', 'aberta'),
  ('anm_sigmine', 'SIGMINE - processos minerários', 'ANM', 'https://geo.anm.gov.br/arcgis/rest/services/SIGMINE/dados_anm/MapServer', 'api', 'aberta'),
  ('dnit_aneel', 'Sistema Nacional de Viação e faixas de utilidade pública de energia', 'DNIT / ANEEL', 'https://geoservicos.inde.gov.br/geoserver/DNIT/ows', 'wfs', 'aberta'),
  ('mapbiomas', 'MapBiomas - uso e cobertura da terra e alertas', 'Rede MapBiomas', 'https://plataforma.alerta.mapbiomas.org/api/v2/graphql', 'api', 'CC BY 4.0')
on conflict (codigo) do nothing;

-- 3. Temas que já existiam: conector, endereço e situação.
update inteligencia.camada set conector = 'sgb_risco', situacao_conector = 'ao_vivo',
       endpoint = 'https://geoportal.sgb.gov.br/server/rest/services/Risco_Geol%C3%B3gico/MapServer/0',
       fontes_descricao = 'SGB/CPRM, setorização de risco geológico'
 where codigo = 'risco';

update inteligencia.camada set conector = 'ibge_setores', situacao_conector = 'ao_vivo', fonte_codigo = 'ibge_geo',
       endpoint = 'https://geoservicos.ibge.gov.br/geoserver', nome = 'Setor censitário e área urbanizada',
       base_legal = 'Lei 13.465/2017, art. 11, I',
       fontes_descricao = 'IBGE, Censo 2022: setores censitários, áreas urbanizadas, favelas e comunidades urbanas',
       parametros = '{"setores": "CGMAT:pbqg22_26_SetoresCensitarios_SetoresCensitarios", "urbanizadas": "CGEO:AU_2026_AreasUrbanizadas2022_Brasil", "fcu": "CGMAT:qg_2022_670_fcu_agreg"}'
 where codigo = 'setor_censitario';

update inteligencia.camada set conector = 'sicar_imoveis', situacao_conector = 'ao_vivo',
       endpoint = 'https://geoserver.car.gov.br/geoserver/sicar/wfs', fontes_descricao = 'SICAR, imóveis rurais por UF',
       parametros = '{"tls_legado": true}'
 where codigo = 'car';

update inteligencia.camada set conector = 'unidades_conservacao_ti', situacao_conector = 'ao_vivo',
       endpoint = 'https://geoservicos.inde.gov.br/geoserver/ICMBio/ows',
       base_legal = 'Lei 9.985/2000', fontes_descricao = 'ICMBio (UCs federais) e FUNAI (terras indígenas)',
       parametros = '{"uc": "ICMBio:limiteucsfederais_a", "funai": "https://geoserver.funai.gov.br/geoserver/Funai/ows", "ti": "Funai:tis_poligonais"}'
 where codigo = 'uc_ti';

update inteligencia.camada set conector = 'iphan_bens', situacao_conector = 'ao_vivo',
       endpoint = 'https://geoserver.iphan.gov.br/geoserver/SICG/ows', fontes_descricao = 'IPHAN (SICG)',
       parametros = '{"sitios": "SICG:sitios", "poligonos": "SICG:bem_poligono", "protecao": "SICG:Bem_Protecao"}'
 where codigo = 'patrimonio';

update inteligencia.camada set endpoint = null,
       observacao = 'O acervo fundiário do INCRA não tinha serviço público no ar em novembro de 2026. As parcelas certificadas entram por arquivo baixado do SIGEF ou por credencial do órgão.'
 where codigo = 'sigef';

update inteligencia.camada set observacao = 'Depende de imagens históricas e de interpretação; sem serviço que responda sozinho.' where codigo = 'marco_temporal';
update inteligencia.camada set observacao = 'Depende do modelo digital de elevação; conector ainda não escrito.' where codigo = 'declividade';
update inteligencia.camada set observacao = 'Dado do município: entra por arquivo ou serviço da prefeitura.' where codigo in ('zoneamento', 'infraestrutura');
update inteligencia.camada set observacao = 'Depende de convênio com o Registro de Imóveis.' where codigo = 'matriculas';

update inteligencia.camada set fontes_descricao = 'OpenStreetMap (Overpass)', fonte_codigo = 'osm',
       parametros = parametros || '{"alternativos": ["https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"]}'
 where codigo = 'hidrografia_app';

-- 4. Temas novos.
insert into inteligencia.camada (codigo, fonte_codigo, nome, base_legal, ordem, fontes_descricao, conector, endpoint, situacao_conector, parametros, observacao) values
  ('cursos_dagua_ana', 'ana_bho', 'Cursos d''água e dominialidade', 'Lei 9.433/1997', 25,
   'ANA, Base Hidrográfica Ottocodificada', 'ana_cursos_dagua',
   'https://www.snirh.gov.br/arcgis/rest/services/SGI/BHO_Dominio_Curso_Dagua/MapServer/0', 'ao_vivo', '{}', null),
  ('contexto_municipal', 'ibge_sidra', 'Contexto municipal', 'Lei 13.465/2017, art. 13', 55,
   'IBGE, Censo 2022 (SIDRA, tabelas 4714 e 4712)', 'ibge_municipio', 'https://apisidra.ibge.gov.br', 'ao_vivo', '{}', null),
  ('assentamentos_quilombos', 'incra_territorios', 'Assentamentos e territórios quilombolas', 'Dec. 4.887/2003', 95,
   'INCRA, pelo serviço público de monitoramento da FUNAI', 'incra_territorios',
   'https://cmr.funai.gov.br/geoserver/CMR-PUBLICO/ows', 'ao_vivo',
   '{"assentamentos": "CMR-PUBLICO:lim_assentamento_rural_a", "quilombolas": "CMR-PUBLICO:lim_quilombolas_a"}', null),
  ('mineracao', 'anm_sigmine', 'Processos minerários', 'Dec.-Lei 227/1967', 105,
   'ANM (SIGMINE), processos ativos', 'anm_processos',
   'https://geo.anm.gov.br/arcgis/rest/services/SIGMINE/dados_anm/MapServer/0', 'ao_vivo', '{}', null),
  ('faixas_infraestrutura', 'dnit_aneel', 'Rodovias federais e faixas de energia', 'Lei 6.766/1979, art. 4º, III', 115,
   'DNIT (Sistema Nacional de Viação) e ANEEL (declarações de utilidade pública)', 'faixas_infraestrutura',
   'https://geoservicos.inde.gov.br/geoserver/DNIT/ows', 'ao_vivo',
   '{"snv": "DNIT:snv_202507a", "dup": "https://sigel.aneel.gov.br/arcgis/rest/services/DadosAbertos/DUP/MapServer/0"}', null),
  ('uso_cobertura', 'mapbiomas', 'Uso e cobertura da terra', 'Lei 12.651/2012', 15,
   'MapBiomas', 'mapbiomas', 'https://plataforma.alerta.mapbiomas.org/api/v2/graphql', 'previsto', '{}',
   'A série de cobertura por área e os alertas exigem conta na plataforma; o conector entra quando houver credencial.');

-- 5. SINTER (Dec. 11.208/2022): o Cadastro Imobiliário Brasileiro identifica cada unidade imobiliária por um
--    código de sete caracteres alfanuméricos e um dígito verificador. O código é atribuído pelo SINTER depois
--    do envio pelo município; aqui ele é só guardado, junto da inscrição imobiliária que já existia.
alter table ladm.la_baunit add column cib text
  constraint la_baunit_cib_formato check (cib is null or cib ~ '^[0-9A-Z]{7}-[0-9A-Z]$');
create unique index la_baunit_cib_vigente on ladm.la_baunit (cib) where cib is not null and end_lifespan_version is null;
comment on column ladm.la_baunit.cib is 'Código do Cadastro Imobiliário Brasileiro (SINTER, Dec. 11.208/2022, art. 4º), formato AAAAAAA-D';
comment on column ladm.la_baunit.inscricao_imobiliaria is 'Inscrição no cadastro imobiliário municipal; chave de envio ao SINTER';
