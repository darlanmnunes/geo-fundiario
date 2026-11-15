"""Exporta do banco o instantâneo que a demonstração estática lê.

    uv run python scripts/exportar_instantaneo.py

Grava apps/web/src/data/instantaneo.json. Rode depois de qualquer alteração no banco que deva
aparecer no site publicado; em desenvolvimento, a interface também pode ler a API ao vivo (GEOF_API_URL).
"""

from __future__ import annotations

import json
from pathlib import Path

from geo_fundiario import gpkg
from geo_fundiario.banco import pool
from geo_fundiario.instantaneo import listar_ids, tudo

RAIZ = Path(__file__).resolve().parents[3]
DESTINO = RAIZ / "apps/web/src/data/instantaneo.json"
PUBLICO = RAIZ / "apps/web/public/dados"


def exportar() -> None:
    pool.open()
    try:
        dados = tudo()
        # GeoPackage de cada núcleo, para baixar no site e abrir no QGIS
        for pid in listar_ids():
            gpkg.exportar(pid, PUBLICO / f"nucleo-{pid}.gpkg")
    finally:
        pool.close()
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":"), default=str), encoding="utf-8")
    unidades = sum(len(p["lotes"]["features"]) for p in dados["projetos"])
    print(f"ok: {len(dados['projetos'])} núcleos, {unidades} unidades → {DESTINO.name} ({DESTINO.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    exportar()
