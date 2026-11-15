"""Edição pelo navegador: situação da unidade, pendências e cadastro social.

Toda gravação roda numa transação que informa ao banco QUEM está alterando (geof.usuario); os gatilhos
de auditoria registram antes e depois. A situação é versionada: fecha-se a vigente e abre-se outra.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from geo_fundiario.acesso import Usuario, exigir
from geo_fundiario.banco import consulta, pool

router = APIRouter(tags=["edição"])
Situacao = Literal["levantado", "cadastrado", "notificado", "pendencia", "apto_crf"]


def transacao(usuario: Usuario | None):
    """Conexão em transação com o autor definido para a auditoria."""
    conn = pool.connection()

    class _Ctx:
        def __enter__(self):
            self.c = conn.__enter__()
            self.c.execute("select set_config('geof.usuario', %s, true)", (usuario.email if usuario else "servico",))
            return self.c

        def __exit__(self, *a):
            return conn.__exit__(*a)

    return _Ctx()


@router.get("/unidades/{unidade_id}", dependencies=[exigir("leitor")])
def unidade(unidade_id: int):
    """Estado atual de uma unidade, direto do banco: é o que o painel de edição mostra."""
    u = consulta(
        """select su.id, su.codigo, su.projeto_id, us.situacao, us.observacao, cs.party_id
             from ladm.la_spatialunit su
             left join reurb.unidade_situacao us on us.spatialunit_id = su.id and us.end_lifespan_version is null
             left join campo.cadastro_social cs on cs.spatialunit_id = su.id
            where su.id = %s and su.nivel = 'lote'""",
        unidade_id,
    )
    if not u:
        raise HTTPException(404, "Unidade não encontrada")
    u = u[0]
    u["pendencias"] = consulta(
        "select id, origem, descricao, base_legal, aberta_em, resolvida_em, resolucao from reurb.pendencia where spatialunit_id = %s order by resolvida_em nulls first, id",
        unidade_id,
    )
    u["documentos"] = consulta(
        """select d.id, d.tipo, d.titulo, d.nome_arquivo, d.mime, d.tamanho_bytes, d.criado_em, d.enviado_por, d.codigo_verificacao
             from documentos.documento d join documentos.vinculo v on v.documento_id = d.id
            where d.situacao = 'ativo' and ((v.entidade = 'spatialunit' and v.entidade_id = %s::text)
                                         or (v.entidade = 'party' and v.entidade_id = %s::text))
            order by d.criado_em desc""",
        unidade_id,
        u["party_id"],
    )
    u["historico"] = consulta(
        """select ocorrido_em, usuario, tabela, operacao from auditoria.evento
            where (tabela = 'reurb.unidade_situacao' and depois->>'spatialunit_id' = %s::text)
               or (tabela = 'reurb.pendencia' and coalesce(depois, antes)->>'spatialunit_id' = %s::text)
            order by ocorrido_em desc limit 10""",
        unidade_id,
        unidade_id,
    )
    return u


class NovaSituacao(BaseModel):
    situacao: Situacao
    observacao: str | None = Field(default=None, max_length=500)


@router.put("/unidades/{unidade_id}/situacao")
def mudar_situacao(unidade_id: int, corpo: NovaSituacao, usuario: Usuario | None = exigir("editor")):
    if not consulta("select 1 from ladm.la_spatialunit where id = %s and nivel = 'lote'", unidade_id):
        raise HTTPException(404, "Unidade não encontrada")
    if corpo.situacao == "apto_crf" and consulta("select 1 from reurb.pendencia where spatialunit_id = %s and resolvida_em is null", unidade_id):
        raise HTTPException(409, "Há pendência em aberto: resolva antes de marcar a unidade como apta à CRF")
    with transacao(usuario) as c:
        c.execute("update reurb.unidade_situacao set end_lifespan_version = now() where spatialunit_id = %s and end_lifespan_version is null", (unidade_id,))
        c.execute("insert into reurb.unidade_situacao (spatialunit_id, situacao, observacao) values (%s, %s, %s)", (unidade_id, corpo.situacao, corpo.observacao))
    return unidade(unidade_id)


class NovaPendencia(BaseModel):
    origem: Literal["documental", "ambiental", "juridica", "tecnica", "social"]
    descricao: str = Field(min_length=5, max_length=500)
    base_legal: str | None = Field(default=None, max_length=200)


@router.post("/unidades/{unidade_id}/pendencias", status_code=201)
def abrir_pendencia(unidade_id: int, corpo: NovaPendencia, usuario: Usuario | None = exigir("editor")):
    alvo = consulta("select projeto_id from ladm.la_spatialunit where id = %s and nivel = 'lote'", unidade_id)
    if not alvo:
        raise HTTPException(404, "Unidade não encontrada")
    with transacao(usuario) as c:
        c.execute(
            "insert into reurb.pendencia (projeto_id, spatialunit_id, origem, descricao, base_legal) values (%s, %s, %s, %s, %s)",
            (alvo[0]["projeto_id"], unidade_id, corpo.origem, corpo.descricao, corpo.base_legal),
        )
        # unidade com pendência nova deixa de estar apta
        c.execute(
            """with fechada as (update reurb.unidade_situacao set end_lifespan_version = now()
                                 where spatialunit_id = %s and end_lifespan_version is null and situacao = 'apto_crf' returning 1)
               insert into reurb.unidade_situacao (spatialunit_id, situacao, observacao)
               select %s, 'pendencia', 'Pendência aberta' from fechada""",
            (unidade_id, unidade_id),
        )
    return unidade(unidade_id)


class Resolucao(BaseModel):
    resolucao: str = Field(min_length=3, max_length=500)


@router.post("/pendencias/{pendencia_id}/resolver")
def resolver_pendencia(pendencia_id: int, corpo: Resolucao, usuario: Usuario | None = exigir("editor")):
    alvo = consulta("select spatialunit_id from reurb.pendencia where id = %s and resolvida_em is null", pendencia_id)
    if not alvo:
        raise HTTPException(404, "Pendência não encontrada ou já resolvida")
    with transacao(usuario) as c:
        c.execute("update reurb.pendencia set resolvida_em = current_date, resolucao = %s where id = %s", (corpo.resolucao, pendencia_id))
    return unidade(alvo[0]["spatialunit_id"])


class CadastroSocial(BaseModel):
    composicao_familiar: int | None = Field(default=None, ge=1, le=30)
    renda_familiar: float | None = Field(default=None, ge=0, le=1_000_000)
    tempo_ocupacao_anos: float | None = Field(default=None, ge=0, le=120)
    uso_imovel: Literal["residencial", "comercial", "misto", "institucional", "vazio"] | None = None
    possui_outro_imovel: bool | None = None


@router.patch("/unidades/{unidade_id}/cadastro-social")
def corrigir_cadastro(unidade_id: int, corpo: CadastroSocial, usuario: Usuario | None = exigir("editor")):
    campos = corpo.model_dump(exclude_none=True)
    if not campos:
        raise HTTPException(422, "Nada a alterar")
    if not consulta("select 1 from campo.cadastro_social where spatialunit_id = %s", unidade_id):
        raise HTTPException(404, "Esta unidade não tem cadastro social")
    atrib = ", ".join(f"{k} = %s" for k in campos)  # nomes vêm do modelo, não do usuário
    with transacao(usuario) as c:
        c.execute(f"update campo.cadastro_social set {atrib} where spatialunit_id = %s", (*campos.values(), unidade_id))  # noqa: S608
    return unidade(unidade_id)
