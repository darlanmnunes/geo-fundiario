from geo_fundiario.geodesia import Vertice, area_shoelace, azimute, gms, memorial_descritivo, meridiano_central


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


def test_memorial_fecha_perimetro():
    vs = [Vertice("M-1", 700000, 7700010), Vertice("M-2", 700010, 7700010),
          Vertice("M-3", 700010, 7700000), Vertice("M-4", 700000, 7700000)]
    txt = memorial_descritivo(titulo="Teste", imovel="Lote", municipio_uf="Viçosa/MG", vertices=vs,
                              confrontantes=["Rua A", "Lote 2", "Rua B", "Lote 4"], srid_utm=31983)
    assert "azimute de 90°00'00\" e distância de 10,00 m até o vértice M-2" in txt
    assert "Área: 100,00 m²" in txt
    assert "fechando assim o perímetro" in txt
    assert "Meridiano Central 45° WGr" in txt
