"""Diagnóstico territorial: análise espacial e validação da área de estudo, sem acesso à rede."""

import pytest
from shapely.geometry import Point, box

from geo_fundiario import diagnostico as d


def area(lado: float = 100.0) -> d.Area:
    base = box(721_000, 7_702_000, 721_000 + lado, 7_702_000 + lado)
    unidades = [box(721_010, 7_702_010, 721_030, 7_702_030), box(721_060, 7_702_060, 721_080, 7_702_080)]
    return d.Area(base, unidades, 31983, "MG", "3171303")


def test_caixa_fica_em_graus_e_cresce_com_o_entorno():
    a = area()
    o, s, e, n = a.caixa(0)
    assert -43 < o < e < -42 and -21 < s < n < -20
    o2, s2, e2, n2 = a.caixa(500)
    assert o2 < o and s2 < s and e2 > e and n2 > n


def test_relacionar_mede_distancia_sobreposicao_e_unidades():
    a = area()
    dentro = d.Feicao(box(721_000, 7_702_000, 721_050, 7_702_050), {"nome": "dentro"})
    longe = d.Feicao(box(721_300, 7_702_000, 721_400, 7_702_100), {"nome": "longe"})
    r = d.relacionar(a, [longe, dentro])
    assert [x.feicao.props["nome"] for x in r] == ["dentro", "longe"]
    assert r[0].toca and r[0].sobreposicao_m2 == pytest.approx(2500) and r[0].unidades == 1
    assert not r[1].toca and r[1].dist_m == pytest.approx(200) and r[1].sobreposicao_m2 == 0


def test_evidencias_saem_em_graus_recortadas_e_limitadas():
    a = area()
    muitas = [d.Feicao(Point(721_050 + i, 7_702_050).buffer(5), {"n": i}) for i in range(60)]
    ev = d.evidencias(a, d.relacionar(a, muitas), lambda p: f"Feição {p['n']}")
    assert len(ev) == d.MAX_EVIDENCIAS
    x, y = ev[0]["geometry"]["coordinates"][0][0]
    assert -43 < x < -42 and -21 < y < -20
    assert ev[0]["properties"]["toca"] is True


def test_geometria_esri_vira_geojson():
    assert d._esri_para_geojson({"x": -42.8, "y": -20.7}) == {"type": "Point", "coordinates": [-42.8, -20.7]}
    assert d._esri_para_geojson({"paths": [[[0, 0], [1, 1]]]})["type"] == "MultiLineString"
    assert d._esri_para_geojson({"rings": [[[0, 0], [1, 0], [1, 1], [0, 0]]]})["type"] == "MultiPolygon"
    assert d._esri_para_geojson({"rings": []}) is None


def test_so_consulta_fontes_em_https():
    with pytest.raises(ValueError, match="https"):
        d._baixar("http://exemplo.gov.br/wfs")


@pytest.mark.parametrize(
    ("geometria", "trecho"),
    [
        ({"type": "Point", "coordinates": [-42.8, -20.7]}, "polígono"),
        ({"type": "Polygon", "coordinates": [[[2, 48], [2.1, 48], [2.1, 48.1], [2, 48]]]}, "Brasil"),
        ({"type": "Polygon", "coordinates": [[[-50, -20], [-48, -20], [-48, -18], [-50, -18], [-50, -20]]]}, "ha"),
    ],
)
def test_area_de_estudo_invalida_e_recusada(geometria, trecho):
    with pytest.raises(ValueError, match=trecho):
        d.diagnosticar_geojson(geometria, "MG", "3171303")


def test_conectores_do_catalogo_tem_funcao():
    assert {"sgb_risco", "ibge_setores", "sicar_imoveis", "unidades_conservacao_ti", "anm_processos"} <= set(d.CONECTORES)
