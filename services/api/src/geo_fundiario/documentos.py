"""Documentos: upload com endereçamento por conteúdo (SHA-256), download e verificação pública.

Os bytes ficam fora do banco: por padrão em GEOF_ARQUIVOS_DIR (sistema de arquivos),
em caminho 2026/ab/<sha256>. Trocar por S3/MinIO é trocar esta classe de armazenamento.
"""

from __future__ import annotations

import hashlib
import shutil
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from geo_fundiario.banco import consulta, pool

router = APIRouter(tags=["documentos"])

ENTIDADES = {"party", "spatialunit", "baunit", "peca", "notificacao", "projeto_fase", "cadastro_social", "levantamento"}


class ArmazenamentoLocal:
    def __init__(self, raiz: Path):
        self.raiz = raiz

    def chave(self, sha256: str) -> str:
        return f"{datetime.now():%Y}/{sha256[:2]}/{sha256}"

    def gravar(self, origem: Path, sha256: str) -> str:
        chave = self.chave(sha256)
        destino = self.raiz / chave
        destino.parent.mkdir(parents=True, exist_ok=True)
        if not destino.exists():
            shutil.move(str(origem), destino)
        return chave

    def caminho(self, chave: str) -> Path:
        return self.raiz / chave


def armazenamento() -> ArmazenamentoLocal:
    from geo_fundiario.banco import cfg

    return ArmazenamentoLocal(Path(cfg.arquivos_dir))


@router.post("/documentos", status_code=201)
async def enviar(
    arquivo: Annotated[UploadFile, File()],
    tipo: Annotated[str, Form()],
    titulo: Annotated[str, Form()],
    projeto_id: Annotated[int | None, Form()] = None,
    entidade: Annotated[str | None, Form()] = None,
    entidade_id: Annotated[str | None, Form()] = None,
    papel: Annotated[str, Form()] = "anexo",
):
    if entidade and entidade not in ENTIDADES:
        raise HTTPException(422, f"entidade deve ser uma de {sorted(ENTIDADES)}")
    arm = armazenamento()
    tmp = arm.raiz / "_tmp" / f"{id(arquivo)}.part"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    h = hashlib.sha256()
    tamanho = 0
    with tmp.open("wb") as f:
        while bloco := await arquivo.read(1 << 20):
            h.update(bloco)
            tamanho += len(bloco)
            f.write(bloco)
    sha = h.hexdigest()
    chave = arm.gravar(tmp, sha)
    with pool.connection() as conn:
        doc = conn.execute(
            """insert into documentos.documento (projeto_id, tipo, titulo, nome_arquivo, mime, tamanho_bytes, sha256, chave_armazenamento)
               values (%s, %s, %s, %s, %s, %s, %s, %s) returning id, codigo_verificacao, sha256, versao""",
            (
                projeto_id,
                tipo,
                titulo,
                arquivo.filename or "arquivo",
                arquivo.content_type or "application/octet-stream",
                tamanho,
                sha,
                chave,
            ),
        ).fetchone()
        if entidade and entidade_id:
            conn.execute(
                "insert into documentos.vinculo (documento_id, entidade, entidade_id, papel) values (%s, %s, %s, %s)",
                (doc["id"], entidade, entidade_id, papel),
            )
    return doc


@router.get("/documentos/{documento_id}")
def detalhe(documento_id: str):
    linhas = consulta(
        """select d.*, coalesce(json_agg(json_build_object('entidade', v.entidade, 'entidade_id', v.entidade_id, 'papel', v.papel))
                      filter (where v.documento_id is not null), '[]'::json) as vinculos,
                  (select coalesce(json_agg(row_to_json(a)), '[]'::json) from documentos.assinatura a where a.documento_id = d.id) as assinaturas
             from documentos.documento d left join documentos.vinculo v on v.documento_id = d.id
            where d.id = %s group by d.id""",
        documento_id,
    )
    if not linhas:
        raise HTTPException(404, "Documento não encontrado")
    linhas[0].pop("busca", None)
    return linhas[0]


@router.get("/documentos/{documento_id}/arquivo")
def arquivo(documento_id: str):
    d = consulta(
        "select nome_arquivo, mime, chave_armazenamento, armazenamento from documentos.documento where id = %s",
        documento_id,
    )
    if not d:
        raise HTTPException(404, "Documento não encontrado")
    if d[0]["armazenamento"] != "local":
        raise HTTPException(501, "Armazenamento S3 ainda não configurado")
    caminho = armazenamento().caminho(d[0]["chave_armazenamento"])
    if not caminho.exists():
        raise HTTPException(410, "Arquivo ausente no armazenamento")
    return FileResponse(caminho, media_type=d[0]["mime"], filename=d[0]["nome_arquivo"])


@router.get("/verificar/{codigo}")
def verificar(codigo: str):
    """Verificação pública (o QR da peça aponta para cá): confirma existência, hash e assinaturas, sem expor o arquivo."""
    d = consulta(
        """select d.id, d.titulo, d.tipo, d.sha256, d.criado_em, d.situacao, p.nome as nucleo,
                  (select json_agg(json_build_object('signatario', a.signatario_nome, 'papel', a.papel, 'metodo', a.metodo, 'situacao', a.situacao, 'assinado_em', a.assinado_em))
                     from documentos.assinatura a where a.documento_id = d.id) as assinaturas
             from documentos.documento d left join reurb.projeto p on p.id = d.projeto_id
            where d.codigo_verificacao = %s""",
        codigo.upper(),
    )
    if not d:
        raise HTTPException(404, "Código de verificação desconhecido")
    return {"autentico": d[0]["situacao"] == "ativo", **d[0]}


@router.get("/projetos/{projeto_id}/documentos")
def por_projeto(projeto_id: int, entidade: str | None = None, entidade_id: str | None = None):
    sql = """select d.id, d.tipo, d.titulo, d.nome_arquivo, d.mime, d.tamanho_bytes, d.sha256, d.origem, d.codigo_verificacao, d.criado_em,
                    v.entidade, v.entidade_id, v.papel
               from documentos.documento d left join documentos.vinculo v on v.documento_id = d.id
              where d.projeto_id = %s and d.situacao = 'ativo'"""
    params: list[object] = [projeto_id]
    if entidade:
        sql += " and v.entidade = %s"
        params.append(entidade)
    if entidade_id:
        sql += " and v.entidade_id = %s"
        params.append(entidade_id)
    return consulta(sql + " order by d.criado_em desc", *params)


@router.get("/projetos/{projeto_id}/pendencias-documentais")
def pendencias(projeto_id: int):
    return consulta(
        "select * from documentos.vw_pendencias_pessoa where projeto_id = %s order by nome, tipo", projeto_id
    )
