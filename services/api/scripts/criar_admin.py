"""Cria (ou redefine a senha de) um administrador. É o único usuário criado fora do navegador.

    uv run python scripts/criar_admin.py "Nome Completo" email@exemplo.br

A senha é pedida no terminal e não aparece na tela nem no histórico. Os demais usuários são criados
pelo administrador, dentro do sistema, em Administração > Usuários.
"""

from __future__ import annotations

import getpass
import sys

from geo_fundiario.acesso import gerar_hash
from geo_fundiario.banco import pool


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    nome, email = sys.argv[1], sys.argv[2]
    senha = getpass.getpass("Senha (mínimo de 10 caracteres, com letras e números): ")
    if len(senha) < 10 or senha.isdigit() or senha.isalpha() or senha != getpass.getpass("Repita a senha: "):
        raise SystemExit("Senha fraca ou as duas digitações não conferem.")
    pool.open()
    with pool.connection() as conn:
        conn.execute(
            """insert into acesso.usuario (nome, email, senha_hash, perfil, criado_por) values (%s, %s, %s, 'administrador', 'criar_admin.py')
               on conflict (lower(email)) do update set senha_hash = excluded.senha_hash, perfil = 'administrador', ativo = true, nome = excluded.nome""",
            (nome, email, gerar_hash(senha)),
        )
    pool.close()
    print(f"Administrador pronto: {email}")


if __name__ == "__main__":
    main()
