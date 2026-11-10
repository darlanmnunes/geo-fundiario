-- Documentos: metadados no PostgreSQL, bytes fora do banco (sistema de arquivos ou S3/MinIO),
-- endereçados pelo SHA-256 do conteúdo. Nada de binário em tabela.
create extension if not exists pgcrypto;  -- gen_random_bytes para o código de verificação
create schema if not exists documentos;
comment on schema documentos is 'Arquivos do processo (anexos, peças emitidas, fotos, comprovantes), versões, vínculos e assinaturas';

create table documentos.tipo_documento (
  codigo text primary key,
  nome text not null,
  grupo text not null check (grupo in ('pessoa','imovel','processo','peca','campo'))
);
insert into documentos.tipo_documento values
  ('rg', 'Documento de identidade', 'pessoa'),
  ('cpf', 'CPF', 'pessoa'),
  ('certidao_casamento', 'Certidão de casamento / união estável', 'pessoa'),
  ('comprovante_renda', 'Comprovante de renda', 'pessoa'),
  ('comprovante_residencia', 'Comprovante de residência', 'pessoa'),
  ('declaracao_nao_proprietario', 'Declaração de não possuir outro imóvel (art. 23, §1º)', 'pessoa'),
  ('contrato_posse', 'Contrato, recibo ou prova da posse', 'imovel'),
  ('matricula', 'Certidão de matrícula / transcrição', 'imovel'),
  ('foto_fachada', 'Foto da fachada', 'campo'),
  ('croqui_campo', 'Croqui de campo', 'campo'),
  ('requerimento', 'Requerimento de instauração', 'processo'),
  ('ato_classificacao', 'Ato de classificação da modalidade', 'processo'),
  ('decreto', 'Decreto', 'processo'),
  ('portaria', 'Portaria', 'processo'),
  ('oficio', 'Ofício', 'processo'),
  ('despacho', 'Despacho', 'processo'),
  ('ata', 'Ata (audiência pública, reunião)', 'processo'),
  ('ar_correios', 'Aviso de recebimento', 'processo'),
  ('publicacao_edital', 'Comprovante de publicação do edital', 'processo'),
  ('peca_emitida', 'Peça técnica emitida pelo sistema', 'peca'),
  ('outro', 'Outro', 'processo');

create table documentos.documento (
  id uuid primary key default gen_random_uuid(),
  projeto_id bigint references reurb.projeto on delete cascade,
  tipo text not null references documentos.tipo_documento,
  titulo text not null,
  descricao text,
  nome_arquivo text not null,
  mime text not null,
  tamanho_bytes bigint not null check (tamanho_bytes >= 0),
  sha256 char(64) not null,
  armazenamento text not null default 'local' check (armazenamento in ('local','s3')),
  chave_armazenamento text not null,           -- ex.: 2026/ab/ab12…  ou bucket/key
  versao int not null default 1,
  versao_anterior_id uuid references documentos.documento,
  origem text not null default 'upload' check (origem in ('upload','emitido','campo','integracao')),
  codigo_verificacao text unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10)),
  situacao text not null default 'ativo' check (situacao in ('ativo','substituido','cancelado')),
  metadados jsonb not null default '{}'::jsonb, -- OCR, EXIF, páginas, coordenadas da foto…
  texto_extraido text,
  busca tsvector generated always as (to_tsvector('portuguese', coalesce(titulo,'') || ' ' || coalesce(texto_extraido,''))) stored,
  enviado_por text not null default current_user,
  criado_em timestamptz not null default now()
);
create index on documentos.documento (projeto_id, tipo);
create index on documentos.documento (sha256);
create index documento_busca on documentos.documento using gin (busca);

-- Um documento pode se ligar a várias entidades (pessoa, lote, peça, notificação, fase).
create table documentos.vinculo (
  documento_id uuid not null references documentos.documento on delete cascade,
  entidade text not null check (entidade in ('party','spatialunit','baunit','peca','notificacao','projeto_fase','cadastro_social','levantamento')),
  entidade_id text not null,                   -- texto: fases usam chave composta "projeto:fase"
  papel text not null default 'anexo' check (papel in ('anexo','comprovante','foto','peca_emitida','publicacao','ciencia')),
  criado_em timestamptz not null default now(),
  primary key (documento_id, entidade, entidade_id, papel)
);
create index on documentos.vinculo (entidade, entidade_id);

-- Assinaturas eletrônicas (ICP-Brasil, gov.br ou assinatura simples com trilha).
create table documentos.assinatura (
  id bigint generated always as identity primary key,
  documento_id uuid not null references documentos.documento on delete cascade,
  signatario_nome text not null,
  signatario_cpf text,
  party_id bigint references ladm.la_party,
  papel text,                                  -- responsável técnico, autoridade, beneficiário…
  metodo text not null check (metodo in ('icp_brasil','gov_br_avancada','gov_br_qualificada','eletronica_simples')),
  situacao text not null default 'pendente' check (situacao in ('pendente','assinado','recusado','expirado')),
  solicitado_em timestamptz not null default now(),
  assinado_em timestamptz,
  hash_assinado char(64),
  certificado jsonb,                           -- emissor, serial, validade
  evidencias jsonb not null default '{}'::jsonb
);
create index on documentos.assinatura (documento_id);

-- Exigências documentais por etapa: o que falta para cada pessoa/imóvel/processo.
create table documentos.exigencia (
  id bigint generated always as identity primary key,
  modalidade text check (modalidade in ('reurb_s','reurb_e')),  -- nulo = ambas
  entidade text not null check (entidade in ('party','spatialunit','projeto')),
  tipo text not null references documentos.tipo_documento,
  fase_codigo text references reurb.fase,
  obrigatorio boolean not null default true,
  base_legal text
);
insert into documentos.exigencia (modalidade, entidade, tipo, fase_codigo, obrigatorio, base_legal) values
  (null, 'party', 'rg', 'levantamento', true, 'Dec. 9.310/2018, art. 38 (qualificação do ocupante)'),
  (null, 'party', 'cpf', 'levantamento', true, 'Dec. 9.310/2018, art. 38'),
  (null, 'party', 'certidao_casamento', 'levantamento', false, 'qualificação completa (estado civil)'),
  ('reurb_s', 'party', 'comprovante_renda', 'classificacao', true, 'Dec. 9.310/2018, art. 6º (até 5 SM)'),
  ('reurb_s', 'party', 'declaracao_nao_proprietario', 'projeto', true, 'Lei 13.465/2017, art. 23, §1º, I'),
  (null, 'spatialunit', 'contrato_posse', 'levantamento', false, 'prova da posse / tempo de ocupação'),
  (null, 'spatialunit', 'foto_fachada', 'levantamento', true, 'cadastro de campo'),
  (null, 'projeto', 'requerimento', 'requerimento', true, 'Lei 13.465/2017, art. 28, I'),
  (null, 'projeto', 'ato_classificacao', 'classificacao', true, 'Lei 13.465/2017, art. 30'),
  (null, 'projeto', 'publicacao_edital', 'notificacao', false, 'Lei 13.465/2017, art. 31, §5º');

-- Auditoria igual às demais tabelas.
do $$
declare t text;
begin
  foreach t in array array['documentos.documento','documentos.vinculo','documentos.assinatura']
  loop
    execute format('create trigger trg_auditoria after insert or update or delete on %s
                    for each row execute function auditoria.fn_registra()', t);
  end loop;
end $$;

-- Pendências documentais por pessoa, calculadas das exigências.
create or replace view documentos.vw_pendencias_pessoa as
select p.id as party_id, p.nome, cs.projeto_id, e.tipo, td.nome as documento, e.obrigatorio, e.base_legal
from ladm.la_party p
join campo.cadastro_social cs on cs.party_id = p.id
join reurb.projeto pr on pr.id = cs.projeto_id
join documentos.exigencia e on e.entidade = 'party' and (e.modalidade is null or e.modalidade = pr.modalidade)
join documentos.tipo_documento td on td.codigo = e.tipo
where not exists (
  select 1 from documentos.vinculo v join documentos.documento d on d.id = v.documento_id
  where v.entidade = 'party' and v.entidade_id = p.id::text and d.tipo = e.tipo and d.situacao = 'ativo');
