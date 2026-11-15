"""Proteção da API: cabeçalhos, limite de requisições, tamanho de corpo e autenticação por token.

O que isto cobre: abuso por volume, enumeração de códigos, envio de arquivos gigantes, leitura de dados
pessoais sem credencial e uso da API a partir de páginas de terceiros. O que NÃO cobre e precisa vir
antes de dados reais: identidade de usuário (OIDC / gov.br), perfis por município e TLS no proxy.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from geo_fundiario.banco import cfg

CABECALHOS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
    "Cross-Origin-Resource-Policy": "same-site",
}
CSP_API = "default-src 'none'; frame-ancestors 'none'"
ROTAS_DOCS = ("/docs", "/redoc", "/openapi.json")
ROTAS_SENSIVEIS = ("/verificar/", "/assistente/", "/auth/")


class JanelaDeslizante:
    """Limite de N eventos por janela, por chave. Em memória: serve a um processo; com vários, usar Redis."""

    def __init__(self, janela_s: float = 60.0):
        self.janela_s = janela_s
        self._eventos: dict[str, deque[float]] = defaultdict(deque)

    def permitir(self, chave: str, limite: int, agora: float | None = None) -> tuple[bool, int]:
        """Devolve (permitido, segundos até liberar)."""
        agora = time.monotonic() if agora is None else agora
        fila = self._eventos[chave]
        while fila and agora - fila[0] >= self.janela_s:
            fila.popleft()
        if len(fila) >= limite:
            return False, max(1, int(self.janela_s - (agora - fila[0])) + 1)
        fila.append(agora)
        if len(self._eventos) > 50_000:  # não deixa a tabela crescer sem fim sob varredura de IPs
            for k in [k for k, f in self._eventos.items() if not f or agora - f[-1] >= self.janela_s]:
                del self._eventos[k]
        return True, 0


def ip_do_cliente(request: Request) -> str:
    if cfg.atras_de_proxy:
        encaminhado = request.headers.get("x-forwarded-for")
        if encaminhado:
            return encaminhado.split(",")[0].strip()
    return request.client.host if request.client else "desconhecido"


class Protecao(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.janela = JanelaDeslizante()

    async def dispatch(self, request: Request, call_next):
        caminho = request.url.path
        tamanho = request.headers.get("content-length")
        if tamanho and tamanho.isdigit() and int(tamanho) > cfg.upload_max_mb * 1024 * 1024:
            return JSONResponse({"detail": f"Corpo acima de {cfg.upload_max_mb} MB"}, status_code=413)

        sensivel = request.method != "GET" or caminho.startswith(ROTAS_SENSIVEIS)
        limite = cfg.limite_sensivel_por_minuto if sensivel else cfg.limite_por_minuto
        ok, espera = self.janela.permitir(f"{ip_do_cliente(request)}:{'s' if sensivel else 'g'}", limite)
        if not ok:
            return JSONResponse(
                {"detail": "Muitas requisições; tente de novo em instantes."},
                status_code=429,
                headers={"Retry-After": str(espera)},
            )

        resposta = await call_next(request)
        for nome, valor in CABECALHOS.items():
            resposta.headers.setdefault(nome, valor)
        if not caminho.startswith(ROTAS_DOCS):
            resposta.headers.setdefault("Content-Security-Policy", CSP_API)
        if cfg.producao:
            resposta.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        if request.method != "GET" or "authorization" in request.headers:
            resposta.headers.setdefault("Cache-Control", "no-store")
        return resposta
