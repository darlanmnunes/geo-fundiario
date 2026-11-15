"""Cálculos no plano UTM (SIRGAS 2000) e redação de memoriais descritivos.

Azimutes e distâncias são planos (grid), como de praxe em memoriais urbanos de REURB.
Para peças que exijam distâncias elipsoidais ou topográficas locais (ex.: NBR 14166),
este módulo é o ponto de extensão.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date

from pyproj import CRS, Proj


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


MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]  # fmt: skip


def fuso_utm(srid_utm: int) -> int:
    return int((meridiano_central(srid_utm) + 183) / 6)


def fatores_cartograficos(srid_utm: int, lon: float, lat: float) -> dict:
    """Convergência meridiana e fator de escala da projeção num ponto (graus decimais, SIRGAS 2000).

    Sinal da convergência como no PROJ: negativo quando o norte da quadrícula fica a oeste do norte
    verdadeiro (no hemisfério sul, a leste do meridiano central).
    """
    f = Proj(CRS.from_epsg(srid_utm)).get_factors(lon, lat)
    return {"convergencia_graus": round(f.meridian_convergence, 6), "fator_escala": round(f.meridional_scale, 6)}


def memorial_descritivo(
    *,
    imovel: str,
    municipio: str,
    uf: str,
    vertices: list[Vertice],
    confrontantes: list[str],
    srid_utm: int,
    titular: str | None = None,
    rotulo_titular: str = "OCUPANTE",
    responsavel: str | None = None,
    art_rrt: str | None = None,
    data: date | None = None,
) -> str:
    """Redige o memorial descritivo: quadro do imóvel, descrição do perímetro e fecho com assinaturas.

    A descrição percorre os vértices na ordem dada (sentido horário a partir do mais ao norte, por
    convenção de quem chama). O confrontante só é citado quando muda de um trecho para o outro.
    """
    segs = segmentos(vertices, confrontantes)
    area = area_shoelace(vertices)
    perimetro = sum(s.distancia_m for s in segs)
    mc = meridiano_central(srid_utm)
    v0 = vertices[0]

    def coord(v: Vertice) -> str:
        return f"de coordenadas {fmt_num(v.n, 3)} m Norte e {fmt_num(v.e, 3)} m Leste"

    partes = [f"Inicia-se a descrição deste perímetro no vértice {v0.codigo}, {coord(v0)}"]
    anterior = None
    for s in segs:
        trecho = "deste, "
        if s.confrontante != anterior:
            trecho += f"confrontando neste trecho com {s.confrontante}, "
            anterior = s.confrontante
        trecho += (
            f"seguindo com distância de {fmt_num(s.distancia_m, 3)} m e azimute plano de "
            f"{gms(s.azimute_graus)} chega-se ao vértice {s.para.codigo}"
        )
        trecho += ", ponto inicial da descrição deste perímetro" if s.para is v0 else f", {coord(s.para)}"
        partes.append(trecho)
    descricao = (
        "; ".join(partes)
        + ". Todas as coordenadas aqui descritas estão georreferenciadas ao Sistema Geodésico Brasileiro, "
        "SIRGAS 2000 (época 2000,4), e encontram-se representadas no Sistema UTM, "
        f"fuso {fuso_utm(srid_utm)} S, referenciadas ao Meridiano Central {abs(mc)}° WGr. "
        "Todos os azimutes e distâncias, área e perímetro foram calculados no plano de projeção UTM."
    )

    linhas = [
        "MEMORIAL DESCRITIVO",
        "",
        f"IMÓVEL: {imovel}",
        f"MUNICÍPIO: {municipio}",
        f"ESTADO: {uf}",
    ]
    if titular:
        linhas.append(f"{rotulo_titular}: {titular}")
    linhas += [
        f"ÁREA: {fmt_num(area)} m² ({fmt_num(area / 10_000, 4)} ha)",
        f"PERÍMETRO: {fmt_num(perimetro)} m",
        "",
        "DESCRIÇÃO DO PERÍMETRO",
        "",
        descricao,
        "",
        "INFORMAÇÕES ADICIONAIS",
        "",
        "A planta em anexo é parte integrante deste memorial descritivo.",
        "Os limites e os nomes dos confrontantes informados no memorial e na planta são os declarados "
        "em campo e conferidos com as demais unidades do levantamento.",
    ]
    if data:
        linhas += ["", f"{municipio}, {data.day} de {MESES[data.month - 1]} de {data.year}."]
    if responsavel:
        linhas += ["", "Responsável técnico:", "______________________________", responsavel]
        if art_rrt:
            linhas.append(f"ART/RRT: {art_rrt}")
    if titular:
        linhas += ["", f"{rotulo_titular.capitalize()}:", "______________________________", titular]
    return "\n".join(linhas)
