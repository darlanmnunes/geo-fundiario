"""Configuração, pool de conexões e utilitários de consulta compartilhados pelos módulos da API."""

from __future__ import annotations

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pydantic_settings import BaseSettings


class Config(BaseSettings):
    """Tudo vem de variáveis de ambiente com prefixo GEOF_ (ver .env.example). Nenhum segredo no código."""

    database_url: str = "postgresql://localhost/geo_fundiario"
    ambiente: str = "desenvolvimento"  # "producao" liga as exigências de autenticação e desliga /docs
    cors_origins: str = "http://localhost:3000"
    hosts: str = "localhost,127.0.0.1,testserver"
    arquivos_dir: str = "var/arquivos"
    upload_max_mb: int = 25
    # SHA-256 (hex) dos tokens aceitos, separados por vírgula. O token em si nunca fica no servidor.
    tokens_leitura: str = ""
    tokens_escrita: str = ""
    limite_por_minuto: int = 120
    limite_sensivel_por_minuto: int = 20
    atras_de_proxy: bool = False  # só então X-Forwarded-For é levado em conta
    # Serviço que traduz pergunta em SQL (modelo de linguagem). Vazio = assistente desligado.
    assistente_url: str = ""
    assistente_token: str = ""

    model_config = {"env_prefix": "GEOF_", "env_file": ".env", "extra": "ignore"}

    @property
    def producao(self) -> bool:
        return self.ambiente == "producao"


cfg = Config()
pool = ConnectionPool(cfg.database_url, open=False, kwargs={"row_factory": dict_row})


def consulta(sql: str, *params) -> list[dict]:
    with pool.connection() as conn:
        return conn.execute(sql, params).fetchall()


def executar(sql: str, *params) -> None:
    with pool.connection() as conn:
        conn.execute(sql, params)
