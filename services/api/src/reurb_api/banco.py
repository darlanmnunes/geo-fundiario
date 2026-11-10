"""Pool de conexões e utilitários de consulta compartilhados pelos módulos da API."""

from __future__ import annotations

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pydantic_settings import BaseSettings


class Config(BaseSettings):
    database_url: str = "postgresql://localhost/reurb_livre"
    cors_origins: str = "http://localhost:3000"
    arquivos_dir: str = "var/arquivos"

    model_config = {"env_prefix": "REURB_"}


cfg = Config()
pool = ConnectionPool(cfg.database_url, open=False, kwargs={"row_factory": dict_row})


def consulta(sql: str, *params) -> list[dict]:
    with pool.connection() as conn:
        return conn.execute(sql, params).fetchall()


def executar(sql: str, *params) -> None:
    with pool.connection() as conn:
        conn.execute(sql, params)
