"""Consultas em linguagem natural — a parte que roda no banco.

Fluxo previsto:
  1. a interface envia a pergunta do gestor;
  2. um serviço externo (modelo de linguagem, GEOF_ASSISTENTE_URL) recebe a pergunta e a descrição do
     esquema `consulta` e devolve UM comando SELECT;
  3. este módulo valida o comando e o executa com o papel `geof_consulta`: só leitura, só o esquema
     `consulta` (visões sem dados pessoais), 5 s de limite e no máximo MAX_LINHAS linhas;
  4. a resposta leva as linhas E o SQL executado, para o gestor poder conferir.

A validação textual abaixo é a primeira barreira; a que de fato segura é o papel do banco
(db/migrations/009_seguranca.sql). O passo 2 fica desligado até o serviço ser configurado.
"""

from __future__ import annotations

import json
import re
import urllib.request

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from geo_fundiario.banco import cfg, pool

router = APIRouter(prefix="/assistente", tags=["assistente"])
MAX_LINHAS = 200
_PROIBIDO = re.compile(
    r"\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|set|reset|listen|notify|"
    r"vacuum|analyze|execute|prepare|lock|comment|refresh|pg_\w+|dblink\w*|lo_\w+|current_setting|set_config)\b",
    re.IGNORECASE,
)
_ESQUEMA_ALHEIO = re.compile(r"\b(ladm|reurb|campo|documentos|inteligencia|auditoria|metadados|public|information_schema)\s*\.", re.IGNORECASE)


class SqlRecusado(ValueError):
    pass


def validar_sql(sql: str) -> str:
    """Aceita um único SELECT (ou WITH ... SELECT) sobre o esquema `consulta`. Devolve o SQL limpo."""
    limpo = sql.strip().rstrip(";").strip()
    if not limpo:
        raise SqlRecusado("consulta vazia")
    if ";" in limpo:
        raise SqlRecusado("apenas um comando por vez")
    if "--" in limpo or "/*" in limpo:
        raise SqlRecusado("comentários não são aceitos")
    if not re.match(r"(?is)^(select|with)\b", limpo):
        raise SqlRecusado("apenas SELECT")
    if achado := _PROIBIDO.search(limpo):
        raise SqlRecusado(f"termo não permitido: {achado.group(0).lower()}")
    if achado := _ESQUEMA_ALHEIO.search(limpo):
        raise SqlRecusado(f"fora do esquema de consulta: {achado.group(1).lower()}")
    return limpo


def executar_consulta(sql: str) -> dict:
    limpo = validar_sql(sql)
    with pool.connection() as conn, conn.transaction():
        conn.execute("set local role geof_consulta")
        conn.execute("set local transaction read only")
        conn.execute("set local statement_timeout = '5s'")
        conn.execute("set local search_path = consulta")
        cursor = conn.execute(f"select * from ({limpo}) _c limit {MAX_LINHAS + 1}")  # noqa: S608 — validado e sob papel restrito
        linhas = cursor.fetchall()
    return {"sql": limpo, "linhas": linhas[:MAX_LINHAS], "truncado": len(linhas) > MAX_LINHAS}


def descrever_esquema() -> list[dict]:
    """Visões e colunas que o modelo de linguagem pode usar: vai no contexto de cada pergunta."""
    with pool.connection() as conn:
        return conn.execute(
            """select c.table_name visao, json_agg(json_build_object('coluna', c.column_name, 'tipo', c.data_type)
                                                    order by c.ordinal_position) colunas
                 from information_schema.columns c where c.table_schema = 'consulta'
                group by c.table_name order by c.table_name"""
        ).fetchall()


class Pergunta(BaseModel):
    pergunta: str = Field(min_length=3, max_length=500)


@router.get("/esquema")
def esquema():
    return {"ativo": bool(cfg.assistente_url), "max_linhas": MAX_LINHAS, "visoes": descrever_esquema()}


@router.post("/consulta")
def perguntar(corpo: Pergunta):
    if not cfg.assistente_url:
        raise HTTPException(503, "Assistente ainda não configurado neste servidor (GEOF_ASSISTENTE_URL)")
    pedido = urllib.request.Request(  # noqa: S310 — URL vem da configuração do servidor, não do usuário
        cfg.assistente_url,
        data=json.dumps({"pergunta": corpo.pergunta, "esquema": descrever_esquema(), "dialeto": "postgresql"}, default=str).encode(),
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {cfg.assistente_token}"} if cfg.assistente_token else {})},
    )
    try:
        with urllib.request.urlopen(pedido, timeout=30) as resp:  # noqa: S310
            sql = json.load(resp).get("sql", "")
    except Exception as erro:  # noqa: BLE001 — qualquer falha do serviço externo vira 502
        raise HTTPException(502, "O serviço de linguagem não respondeu") from erro
    try:
        return {"pergunta": corpo.pergunta, **executar_consulta(sql)}
    except SqlRecusado as erro:
        raise HTTPException(422, f"A consulta gerada foi recusada: {erro}") from erro
