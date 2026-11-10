"""Cálculos no plano UTM (SIRGAS 2000) e redação de memoriais descritivos.

Azimutes e distâncias são planos (grid), como de praxe em memoriais urbanos de REURB.
Para peças que exijam distâncias elipsoidais ou topográficas locais (ex.: NBR 14166),
este módulo é o ponto de extensão.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from pyproj import CRS


@dataclass(frozen=True)
class Vertice:
    codigo: str
    e: float
    n: float


@dataclass(frozen=True)
class Segmento:
    de: Vertice
    para: Vertice
    azimute_graus: float
    distancia_m: float
    confrontante: str


def azimute(e1: float, n1: float, e2: float, n2: float) -> float:
    """Azimute plano a partir do Norte da quadrícula, em graus [0, 360)."""
    return math.degrees(math.atan2(e2 - e1, n2 - n1)) % 360.0


def distancia(e1: float, n1: float, e2: float, n2: float) -> float:
    return math.hypot(e2 - e1, n2 - n1)


def area_shoelace(vertices: list[Vertice]) -> float:
    soma = 0.0
    for a, b in zip(vertices, vertices[1:] + vertices[:1]):
        soma += a.e * b.n - b.e * a.n
    return abs(soma) / 2.0


def gms(graus: float) -> str:
    """Formata ângulo como 102°15'30\"."""
    total = round(graus * 3600)
    g, resto = divmod(total, 3600)
    m, s = divmod(resto, 60)
    return f"{g % 360:d}°{m:02d}'{s:02d}\""


def fmt_num(valor: float, casas: int = 2) -> str:
    """Formato numérico brasileiro: 7.702.345,678."""
    txt = f"{valor:,.{casas}f}"
    return txt.replace(",", "_").replace(".", ",").replace("_", ".")


def meridiano_central(srid_utm: int) -> int:
    crs = CRS.from_epsg(srid_utm)
    for p in crs.coordinate_operation.params:
        if "longitude" in p.name.lower() and "origin" in p.name.lower():
            return int(round(p.value))
    raise ValueError(f"SRID {srid_utm} não é UTM")


def segmentos(vertices: list[Vertice], confrontantes: list[str]) -> list[Segmento]:
    out = []
    for i, a in enumerate(vertices):
        b = vertices[(i + 1) % len(vertices)]
        out.append(
            Segmento(
                a,
                b,
                azimute(a.e, a.n, b.e, b.n),
                distancia(a.e, a.n, b.e, b.n),
                confrontantes[i],
            )
        )
    return out


def memorial_descritivo(
    *,
    titulo: str,
    imovel: str,
    municipio_uf: str,
    vertices: list[Vertice],
    confrontantes: list[str],
    srid_utm: int,
    responsavel: str | None = None,
    art_rrt: str | None = None,
) -> str:
    """Redige o memorial no padrão usual de georreferenciamento (vértices, azimutes, distâncias)."""
    segs = segmentos(vertices, confrontantes)
    area = area_shoelace(vertices)
    perimetro = sum(s.distancia_m for s in segs)
    mc = meridiano_central(srid_utm)
    v0 = vertices[0]

    linhas = [
        f"MEMORIAL DESCRITIVO — {titulo}",
        "",
        f"Imóvel: {imovel}",
        f"Município/UF: {municipio_uf}",
        f"Área: {fmt_num(area)} m²    Perímetro: {fmt_num(perimetro)} m",
        "",
        (
            f"Inicia-se a descrição deste perímetro no vértice {v0.codigo}, de coordenadas "
            f"N {fmt_num(v0.n, 3)} m e E {fmt_num(v0.e, 3)} m;"
        ),
    ]
    for s in segs:
        fim = "início da descrição" if s.para is v0 else f"vértice {s.para.codigo}"
        coord = "" if s.para is v0 else f", de coordenadas N {fmt_num(s.para.n, 3)} m e E {fmt_num(s.para.e, 3)} m"
        linhas.append(
            f"deste, segue confrontando com {s.confrontante}, com azimute de {gms(s.azimute_graus)} "
            f"e distância de {fmt_num(s.distancia_m)} m até o {fim}{coord};"
        )
    linhas[-1] = linhas[-1].rstrip(";") + ", fechando assim o perímetro acima descrito."
    linhas += [
        "",
        (
            "Todas as coordenadas aqui descritas estão georreferenciadas ao Sistema Geodésico Brasileiro "
            f"e encontram-se representadas no Sistema UTM, referenciadas ao Meridiano Central {abs(mc)}° WGr, "
            "tendo como datum o SIRGAS 2000. Todos os azimutes e distâncias, área e perímetro foram "
            "calculados no plano de projeção UTM."
        ),
    ]
    if responsavel:
        linhas += [
            "",
            f"Responsável técnico: {responsavel}" + (f" — ART/RRT {art_rrt}" if art_rrt else ""),
        ]
    return "\n".join(linhas)
