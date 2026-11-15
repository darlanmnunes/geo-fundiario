import pytest

from geo_fundiario.acesso import conferir_senha, gerar_hash
from geo_fundiario.assistente import SqlRecusado, validar_sql
from geo_fundiario.seguranca import JanelaDeslizante


def test_janela_limita_e_libera():
    j = JanelaDeslizante(janela_s=60)
    assert all(j.permitir("ip", 3, agora=t)[0] for t in (0, 1, 2))
    permitido, espera = j.permitir("ip", 3, agora=3)
    assert not permitido and 1 <= espera <= 60
    assert j.permitir("outro", 3, agora=3)[0]
    assert j.permitir("ip", 3, agora=61)[0]


def test_senha_scrypt():
    h = gerar_hash("uma-senha-longa-1")
    assert h.startswith("scrypt$") and "uma-senha" not in h
    assert conferir_senha("uma-senha-longa-1", h)
    assert not conferir_senha("outra", h)
    assert not conferir_senha("x", "lixo")
    assert gerar_hash("uma-senha-longa-1") != h  # sal por usuário


@pytest.mark.parametrize(
    "sql",
    [
        "select nome, unidades from nucleo order by unidades desc",
        "with a as (select situacao, count(*) n from unidade group by 1) select * from a;",
        "SELECT count(*) FROM consulta.unidade WHERE situacao = 'apto_crf'",
    ],
)
def test_sql_aceito(sql):
    assert validar_sql(sql)


@pytest.mark.parametrize(
    "sql",
    [
        "",
        "delete from unidade",
        "select 1; drop table x",
        "select * from ladm.la_party",
        "select * from unidade -- comentário",
        "select pg_read_file('/etc/passwd')",
        "select set_config('role', 'postgres', false)",
        "update unidade set situacao = 'apto_crf'",
        "select * from information_schema.tables",
    ],
)
def test_sql_recusado(sql):
    with pytest.raises(SqlRecusado):
        validar_sql(sql)
