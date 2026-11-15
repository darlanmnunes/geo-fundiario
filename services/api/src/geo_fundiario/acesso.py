"""Login, sessões e gestão de usuários.

Perfis: administrador (gerencia usuários), editor (insere e corrige dados e documentos), leitor (consulta).
Senha guardada só como derivação scrypt com sal por usuário. A sessão é um token aleatório entregue ao
navegador; o banco guarda apenas o SHA-256 dele, com validade de 12 horas.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from geo_fundiario.banco import cfg, consulta, pool

router = APIRouter(tags=["acesso"])
Perfil = Literal["administrador", "editor", "leitor"]
NIVEL = {"leitor": 1, "editor": 2, "administrador": 3}
VALIDADE = timedelta(hours=12)
_N, _R, _P = 2**15, 8, 1


def gerar_hash(senha: str) -> str:
    sal = secrets.token_bytes(16)
    h = hashlib.scrypt(senha.encode(), salt=sal, n=_N, r=_R, p=_P, maxmem=64 * 1024 * 1024, dklen=32)
    return f"scrypt${_N}${_R}${_P}${sal.hex()}${h.hex()}"


def conferir_senha(senha: str, guardado: str) -> bool:
    try:
        _, n, r, p, sal, h = guardado.split("$")
        calc = hashlib.scrypt(senha.encode(), salt=bytes.fromhex(sal), n=int(n), r=int(r), p=int(p), maxmem=64 * 1024 * 1024, dklen=32)
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(calc.hex(), h)


def validar_senha(senha: str) -> None:
    if len(senha) < 10 or senha.isdigit() or senha.isalpha():
        raise HTTPException(422, "A senha precisa de ao menos 10 caracteres, com letras e números")


class Usuario(BaseModel):
    id: int
    nome: str
    email: str
    perfil: Perfil


_portador = HTTPBearer(auto_error=False)


def usuario_da_sessao(token: str) -> Usuario | None:
    linhas = consulta(
        """select u.id, u.nome, u.email, u.perfil from acesso.sessao s join acesso.usuario u on u.id = s.usuario_id
            where s.token_sha256 = %s and s.expira_em > now() and u.ativo""",
        hashlib.sha256(token.encode()).hexdigest(),
    )
    return Usuario(**linhas[0]) if linhas else None


def token_de_servico(token: str, minimo: str) -> bool:
    """Tokens fixos de integração (GEOF_TOKENS_*), para serviços e para a geração do site."""
    aceitos = cfg.tokens_escrita if minimo != "leitor" else f"{cfg.tokens_leitura},{cfg.tokens_escrita}"
    resumo = hashlib.sha256(token.encode()).hexdigest()
    return any(hmac.compare_digest(resumo, h.strip().lower()) for h in aceitos.split(",") if h.strip())


def exigir(minimo: Perfil | Literal["leitura", "escrita"]):
    """Dependência de rota. Aceita sessão de usuário com perfil suficiente ou token de serviço.

    Em desenvolvimento, as rotas de LEITURA ficam abertas se não houver nenhum usuário nem token
    configurado, para o uso local. Escrita sempre exige identificação: é ela que vai para a auditoria.
    """
    minimo = {"leitura": "leitor", "escrita": "editor"}.get(minimo, minimo)

    def verificar(request: Request, credencial: HTTPAuthorizationCredentials | None = Depends(_portador)) -> Usuario | None:  # noqa: B008
        if credencial:
            usuario = usuario_da_sessao(credencial.credentials)
            if usuario:
                if NIVEL[usuario.perfil] < NIVEL[minimo]:
                    raise HTTPException(403, "Seu perfil não permite esta operação")
                request.state.usuario = usuario
                return usuario
            if minimo != "administrador" and token_de_servico(credencial.credentials, minimo):
                return None
            raise HTTPException(401, "Sessão expirada ou inválida", headers={"WWW-Authenticate": "Bearer"})
        if minimo == "leitor" and not cfg.producao and not (cfg.tokens_leitura or cfg.tokens_escrita):
            return None
        raise HTTPException(401, "Entre no sistema para continuar", headers={"WWW-Authenticate": "Bearer"})

    return Depends(verificar)


class Entrada(BaseModel):
    email: EmailStr
    senha: str = Field(min_length=1, max_length=200)


@router.post("/auth/entrar")
def entrar(corpo: Entrada, request: Request):
    linhas = consulta("select id, nome, email, perfil, senha_hash, ativo from acesso.usuario where lower(email) = lower(%s)", corpo.email)
    # mesma resposta e mesmo custo para e-mail inexistente e senha errada
    guardado = linhas[0]["senha_hash"] if linhas else gerar_hash("senha-de-comparacao")
    if not conferir_senha(corpo.senha, guardado) or not linhas or not linhas[0]["ativo"]:
        raise HTTPException(401, "E-mail ou senha incorretos")
    u = linhas[0]
    token = secrets.token_urlsafe(32)
    with pool.connection() as conn:
        conn.execute("delete from acesso.sessao where expira_em < now()")
        conn.execute(
            "insert into acesso.sessao (token_sha256, usuario_id, expira_em, ip) values (%s, %s, %s, %s)",
            (hashlib.sha256(token.encode()).hexdigest(), u["id"], datetime.now(UTC) + VALIDADE, request.client.host if request.client else None),
        )
        conn.execute("update acesso.usuario set ultimo_acesso = now() where id = %s", (u["id"],))
    return {"token": token, "expira_em_horas": 12, "usuario": {"id": u["id"], "nome": u["nome"], "email": u["email"], "perfil": u["perfil"]}}


@router.post("/auth/sair", status_code=204)
def sair(credencial: HTTPAuthorizationCredentials | None = Depends(_portador)):  # noqa: B008
    if credencial:
        with pool.connection() as conn:
            conn.execute("delete from acesso.sessao where token_sha256 = %s", (hashlib.sha256(credencial.credentials.encode()).hexdigest(),))


@router.get("/auth/eu")
def eu(usuario: Usuario | None = exigir("leitor")):
    if usuario is None:
        raise HTTPException(401, "Sem sessão de usuário")
    return usuario


class NovoUsuario(BaseModel):
    nome: str = Field(min_length=3, max_length=120)
    email: EmailStr
    senha: str
    perfil: Perfil = "editor"


class AlteracaoUsuario(BaseModel):
    nome: str | None = Field(default=None, min_length=3, max_length=120)
    perfil: Perfil | None = None
    ativo: bool | None = None
    senha: str | None = None


@router.get("/usuarios")
def listar(_: Usuario | None = exigir("administrador")):
    return consulta("select id, nome, email, perfil, ativo, criado_em, criado_por, ultimo_acesso from acesso.usuario order by nome")


@router.post("/usuarios", status_code=201)
def criar(corpo: NovoUsuario, admin: Usuario | None = exigir("administrador")):
    validar_senha(corpo.senha)
    if consulta("select 1 from acesso.usuario where lower(email) = lower(%s)", corpo.email):
        raise HTTPException(409, "Já existe usuário com este e-mail")
    return consulta(
        """insert into acesso.usuario (nome, email, senha_hash, perfil, criado_por) values (%s, %s, %s, %s, %s)
           returning id, nome, email, perfil, ativo""",
        corpo.nome, corpo.email, gerar_hash(corpo.senha), corpo.perfil, admin and admin.email,
    )[0]  # fmt: skip


@router.patch("/usuarios/{usuario_id}")
def alterar(usuario_id: int, corpo: AlteracaoUsuario, admin: Usuario | None = exigir("administrador")):
    alvo = consulta("select id, perfil, ativo from acesso.usuario where id = %s", usuario_id)
    if not alvo:
        raise HTTPException(404, "Usuário não encontrado")
    deixa_de_ser_admin = alvo[0]["perfil"] == "administrador" and (corpo.ativo is False or (corpo.perfil and corpo.perfil != "administrador"))
    if deixa_de_ser_admin and not consulta("select 1 from acesso.usuario where perfil = 'administrador' and ativo and id <> %s", usuario_id):
        raise HTTPException(409, "Este é o único administrador ativo; promova outro antes")
    if corpo.senha:
        validar_senha(corpo.senha)
    with pool.connection() as conn:
        conn.execute(
            """update acesso.usuario set nome = coalesce(%s, nome), perfil = coalesce(%s, perfil), ativo = coalesce(%s, ativo),
                      senha_hash = coalesce(%s, senha_hash) where id = %s""",
            (corpo.nome, corpo.perfil, corpo.ativo, gerar_hash(corpo.senha) if corpo.senha else None, usuario_id),
        )
        if corpo.ativo is False or corpo.senha:
            conn.execute("delete from acesso.sessao where usuario_id = %s", (usuario_id,))
    return consulta("select id, nome, email, perfil, ativo from acesso.usuario where id = %s", usuario_id)[0]
