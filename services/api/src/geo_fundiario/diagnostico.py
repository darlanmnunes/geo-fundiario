"""Diagnóstico territorial: cada tema é respondido por um CONECTOR que consulta a fonte em tempo real.

Um conector recebe o perímetro (shapely, no UTM do projeto) e devolve um achado: severidade, resultado,
implicação e métricas. O catálogo (inteligencia.camada) diz qual conector atende cada tema e se ele já
está ligado ("ao_vivo") ou só previsto. Para acrescentar uma fonte, escreve-se uma função e registra-se
em CONECTORES; nada mais muda na API nem na interface.
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from collections.abc import Callable
from datetime import UTC, datetime

from pyproj import Transformer
from shapely import wkb
from shapely.geometry import LineString, Polygon
from shapely.ops import transform as reprojetar

from geo_fundiario.banco import consulta

FAIXA_APP_M = 30.0


def osm_hidrografia(perimetro, unidades: list, srid: int, endpoint: str) -> dict:
    """Corpos d'água do OpenStreetMap a até 150 m do perímetro, via Overpass."""
    para_geo = Transformer.from_crs(srid, 4674, always_xy=True).transform
    para_utm = Transformer.from_crs(4674, srid, always_xy=True).transform
    oeste, sul, leste, norte = reprojetar(para_geo, perimetro.buffer(150)).bounds
    caixa = f"{sul:.6f},{oeste:.6f},{norte:.6f},{leste:.6f}"
    q = f'[out:json][timeout:25];(way["natural"="water"]({caixa});way["waterway"~"river|stream|canal"]({caixa}););out geom;'
    req = urllib.request.Request(endpoint, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": "diagnostico-territorial/1.0"})
    with urllib.request.urlopen(req, timeout=40) as resp:  # noqa: S310 — endereço vem do catálogo do banco
        elementos = json.load(resp)["elements"]
    aguas = []
    for el in elementos:
        pts = [(p["lon"], p["lat"]) for p in el.get("geometry", [])]
        if len(pts) >= 2:
            g = Polygon(pts) if pts[0] == pts[-1] and len(pts) >= 4 and "waterway" not in el.get("tags", {}) else LineString(pts)
            aguas.append(reprojetar(para_utm, g))
    if not aguas:
        return {"severidade": "ok", "resultado": "Nenhum corpo d'água a menos de 150 m do perímetro.", "implicacao": None, "metricas": {"distancia_min_m": None}}
    dist = min(a.distance(perimetro) for a in aguas)
    na_faixa = sum(1 for u in unidades if min(a.distance(u) for a in aguas) < FAIXA_APP_M)
    metricas = {"distancia_min_m": round(dist, 1), "unidades_na_faixa": na_faixa, "faixa_m": FAIXA_APP_M, "feicoes": len(aguas)}
    if na_faixa:
        margem = "o perímetro toca a margem" if dist < 1 else f"o perímetro fica a {dist:.0f} m da margem mais próxima"
        return {"severidade": "condiciona", "metricas": metricas,
                "resultado": f"{na_faixa} de {len(unidades)} unidades a menos de {FAIXA_APP_M:.0f} m de corpo d'água; {margem}.",
                "implicacao": "Faixa não edificável de 15 m (REURB-E) ou estudo técnico com melhoria ambiental (REURB-S, art. 64)."}  # fmt: skip
    return {"severidade": "atencao", "metricas": metricas,
            "resultado": f"Corpo d'água a {dist:.0f} m do perímetro; nenhuma unidade na faixa de {FAIXA_APP_M:.0f} m.",
            "implicacao": "Registrar no estudo técnico ambiental; sem restrição direta às unidades."}  # fmt: skip


CONECTORES: dict[str, Callable[..., dict]] = {"osm_hidrografia": osm_hidrografia}


def catalogo() -> list[dict]:
    return consulta(
        """select c.codigo, c.nome, c.fontes_descricao fonte, c.base_legal base, c.conector, c.endpoint,
                  c.situacao_conector situacao, f.orgao, f.licenca
             from inteligencia.camada c left join inteligencia.fonte f on f.codigo = c.fonte_codigo order by c.ordem"""
    )


def diagnosticar(pid: int) -> dict:
    """Roda os conectores ligados sobre o perímetro vigente e devolve os achados (sem gravar)."""
    p = consulta(
        """select pr.srid_utm, ST_AsBinary(ST_Transform(n.geom, pr.srid_utm)) g from reurb.projeto pr
             join ladm.la_spatialunit n on n.projeto_id = pr.id and n.nivel = 'nucleo' and n.end_lifespan_version is null
            where pr.id = %s""",
        pid,
    )
    if not p:
        return {}
    srid = p[0]["srid_utm"]
    perimetro = wkb.loads(bytes(p[0]["g"]))
    unidades = [
        wkb.loads(bytes(r["g"]))
        for r in consulta(
            "select ST_AsBinary(ST_Transform(geom, %s)) g from ladm.la_spatialunit where projeto_id = %s and nivel = 'lote' and end_lifespan_version is null",
            srid,
            pid,
        )
    ]
    achados = []
    for c in catalogo():
        funcao = CONECTORES.get(c["conector"] or "")
        if c["situacao"] != "ao_vivo" or not funcao:
            continue
        try:
            achado = funcao(perimetro, unidades, srid, c["endpoint"])
            achados.append({"camada": c["nome"], "fonte": c["fonte"], "base": c["base"], "origem": "calculado", **achado})
        except Exception as erro:  # noqa: BLE001 — a fonte externa pode estar fora do ar; o dossiê não pode cair por isso
            achados.append({"camada": c["nome"], "fonte": c["fonte"], "base": c["base"], "origem": "calculado", "severidade": "sem_dado",
                            "resultado": "A fonte não respondeu agora.", "implicacao": "Tentar de novo mais tarde.", "metricas": {"erro": type(erro).__name__}})  # fmt: skip
    return {"projeto_id": pid, "consultado_em": datetime.now(UTC).isoformat(timespec="seconds"), "achados": achados}
