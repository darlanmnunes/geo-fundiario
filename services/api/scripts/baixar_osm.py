"""Baixa do OpenStreetMap as feições que servem de cenário aos dados de demonstração.

Edificações, logradouros nomeados e corpos d'água do campus da UFV (Viçosa-MG), via Overpass.
O resultado fica versionado em db/seed/osm/ufv_campus.geojson para que o gerador de dados
(gerar_seed.py) funcione sem rede e produza sempre o mesmo resultado.

    uv run python scripts/baixar_osm.py

Dados © colaboradores do OpenStreetMap, licença ODbL 1.0 (https://www.openstreetmap.org/copyright).
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
DESTINO = RAIZ / "db/seed/osm/ufv_campus.geojson"
CAIXA = "-20.7700,-42.8790,-20.7540,-42.8590"  # sul, oeste, norte, leste
SERVIDORES = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
CONSULTA = f"""[out:json][timeout:90];
(way["building"]({CAIXA});
 way["highway"]["name"]({CAIXA});
 way["natural"="water"]({CAIXA});
 way["waterway"]({CAIXA}););
out geom tags;"""


def classe(tags: dict) -> str | None:
    if "building" in tags:
        return "edificacao"
    if "highway" in tags:
        return "logradouro"
    if tags.get("natural") == "water" or "waterway" in tags:
        return "agua"
    return None


def baixar() -> None:
    dados = urllib.parse.urlencode({"data": CONSULTA}).encode()
    bruto = None
    for servidor in SERVIDORES:  # os servidores públicos oscilam: tenta o próximo se um falhar
        req = urllib.request.Request(servidor, data=dados, headers={"User-Agent": "gerador-de-dados-de-demonstracao/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                bruto = json.load(resp)
            break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as erro:
            print(f"falhou em {servidor}: {erro}")
    if bruto is None:
        raise SystemExit("nenhum servidor Overpass respondeu; tente de novo mais tarde")

    feicoes = []
    for el in bruto["elements"]:
        tags = el.get("tags", {})
        cls = classe(tags)
        coords = [[round(p["lon"], 7), round(p["lat"], 7)] for p in el.get("geometry", [])]
        if not cls or len(coords) < 2:
            continue
        fechado = coords[0] == coords[-1] and len(coords) >= 4
        if cls == "edificacao" and not fechado:
            continue
        poligono = fechado and cls != "logradouro" and "waterway" not in tags
        feicoes.append(
            {
                "type": "Feature",
                "properties": {"osm_id": el["id"], "classe": cls, "nome": tags.get("name")},
                "geometry": {"type": "Polygon", "coordinates": [coords]}
                if poligono
                else {"type": "LineString", "coordinates": coords},
            }
        )
    feicoes.sort(key=lambda f: f["properties"]["osm_id"])
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "atribuicao": "© colaboradores do OpenStreetMap — ODbL 1.0",
                "base_osm": bruto.get("osm3s", {}).get("timestamp_osm_base"),
                "features": feicoes,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    contagem = {c: sum(1 for f in feicoes if f["properties"]["classe"] == c) for c in ("edificacao", "logradouro", "agua")}
    print(f"ok: {contagem} → {DESTINO.relative_to(RAIZ)}")


if __name__ == "__main__":
    baixar()
