from geo_fundiario.geodesia import (
    Vertice,
    area_shoelace,
    azimute,
    fatores_cartograficos,
    fuso_utm,
    gms,
    memorial_descritivo,
    meridiano_central,
)


def test_azimutes_cardeais():
    assert azimute(0, 0, 0, 10) == 0
    assert azimute(0, 0, 10, 0) == 90
    assert azimute(0, 0, 0, -10) == 180
    assert azimute(0, 0, -10, 0) == 270


def test_gms_arredonda_segundos():
    assert gms(102.258333) == "102°15'30\""
    assert gms(359.99999) == "0°00'00\""


def test_area_quadrado():
    vs = [Vertice("A", 0, 10), Vertice("B", 10, 10), Vertice("C", 10, 0), Vertice("D", 0, 0)]
    assert area_shoelace(vs) == 100


def test_meridiano_central_utm_23s():
    assert meridiano_central(31983) == -45


def _quadrado():
    return [Vertice("M-1", 700000, 7700010), Vertice("M-2", 700010, 7700010),
            Vertice("M-3", 700010, 7700000), Vertice("M-4", 700000, 7700000)]  # fmt: skip


def test_memorial_fecha_perimetro():
    txt = memorial_descritivo(imovel="Lote", municipio="Viçosa", uf="MG", vertices=_quadrado(),
                              confrontantes=["Rua A", "Lote 2", "Rua B", "Lote 4"], srid_utm=31983)  # fmt: skip
    assert "seguindo com distância de 10,000 m e azimute plano de 90°00'00\" chega-se ao vértice M-2" in txt
    assert "ÁREA: 100,00 m² (0,0100 ha)" in txt
    assert "chega-se ao vértice M-1, ponto inicial da descrição deste perímetro" in txt
    assert "fuso 23 S, referenciadas ao Meridiano Central 45° WGr" in txt


def test_memorial_cita_confrontante_so_quando_muda():
    txt = memorial_descritivo(imovel="Lote", municipio="Viçosa", uf="MG", vertices=_quadrado(),
                              confrontantes=["Rua A", "Rua A", "Lote 2", "Lote 2"], srid_utm=31983)  # fmt: skip
    assert txt.count("confrontando neste trecho com Rua A") == 1
    assert txt.count("confrontando neste trecho com Lote 2") == 1


def test_memorial_assinaturas_e_data():
    from datetime import date

    txt = memorial_descritivo(imovel="Lote", municipio="Viçosa", uf="MG", vertices=_quadrado(),
                              confrontantes=["Rua A"] * 4, srid_utm=31983, titular="Fulana de Tal",
                              responsavel="Eng. Exemplo", art_rrt="MG0", data=date(2026, 3, 1))  # fmt: skip
    assert "OCUPANTE: Fulana de Tal" in txt
    assert "Viçosa, 1 de março de 2026." in txt
    assert "ART/RRT: MG0" in txt


def test_fuso_e_fatores_cartograficos():
    assert fuso_utm(31983) == 23
    f = fatores_cartograficos(31983, -42.869572, -20.764239)
    # 0°45'20" no campus da UFV; negativo = norte da quadrícula a oeste do norte verdadeiro
    assert abs(f["convergencia_graus"] + 0.7556) < 0.001
    assert abs(f["fator_escala"] - 1.000206) < 0.00001
