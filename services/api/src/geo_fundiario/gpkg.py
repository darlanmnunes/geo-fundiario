"""Exporta um núcleo em GeoPackage (OGC), para abrir e editar no QGIS.

Escrito só com sqlite3 e shapely: um GeoPackage é um SQLite com três tabelas de catálogo e as
geometrias em WKB precedidas de um cabeçalho de 8 bytes. Camadas em SIRGAS 2000 geográfico (EPSG:4674),
a geometria canônica do banco; os vértices levam também E, N no UTM do projeto.
"""

from __future__ import annotations

import sqlite3
import struct
from pathlib import Path

from pyproj import CRS
from shapely import wkb

from geo_fundiario.banco import consulta

SRS = 4674


def _blob(g) -> bytes:
    # 'GP', versão 0, flags 0x01 (little endian, sem envelope), srs_id, WKB
    return b"GP" + struct.pack("<BBi", 0, 1, SRS) + wkb.dumps(g, output_dimension=2, byte_order=1)


def exportar(pid: int, destino: Path) -> Path:
    srid = consulta("select srid_utm from reurb.projeto where id = %s", pid)[0]["srid_utm"]
    camadas = {
        "unidades": ("MULTIPOLYGON", ["codigo TEXT", "quadra TEXT", "situacao TEXT", "area_m2 REAL", "perimetro_m REAL", "pendencias INTEGER"],
            """select ST_AsBinary(su.geom) g, su.codigo, q.codigo quadra, us.situacao, su.area_m2::float area_m2, su.perimetro_m::float perimetro_m,
                      (select count(*) from reurb.pendencia p where p.spatialunit_id = su.id and p.resolvida_em is null) pendencias
                 from ladm.la_spatialunit su left join ladm.la_spatialunit q on q.id = su.parent_id
                 left join reurb.unidade_situacao us on us.spatialunit_id = su.id and us.end_lifespan_version is null
                where su.projeto_id = %s and su.nivel = 'lote' and su.end_lifespan_version is null order by su.codigo"""),
        "quadras": ("MULTIPOLYGON", ["codigo TEXT", "area_m2 REAL"],
            "select ST_AsBinary(geom) g, codigo, area_m2::float area_m2 from ladm.la_spatialunit where projeto_id = %s and nivel = 'quadra' and end_lifespan_version is null order by codigo"),
        "perimetro": ("MULTIPOLYGON", ["nome TEXT", "area_m2 REAL"],
            "select ST_AsBinary(geom) g, rotulo, area_m2::float area_m2 from ladm.la_spatialunit where projeto_id = %s and nivel = 'nucleo' and end_lifespan_version is null"),
        "vertices": ("POINT", ["codigo TEXT", "tipo TEXT", "metodo TEXT", "e_utm REAL", "n_utm REAL", "h REAL", "sigma_e REAL", "sigma_n REAL", "sigma_h REAL", "erro_m REAL", "tolerancia_m REAL", "atende INTEGER"],
            f"""select ST_AsBinary(ST_Force2D(p.geom)) g, p.codigo, p.tipo, p.metodo, ST_X(u) e_utm, ST_Y(u) n_utm, ST_Z(p.geom) h,
                       p.sigma_e::float sigma_e, p.sigma_n::float sigma_n, p.sigma_h::float sigma_h, c.erro_m::float erro_m, c.tolerancia_m::float tolerancia_m, c.atende::int atende
                  from ladm.la_point p join ladm.vw_conformidade_vertice c on c.id = p.id,
                       lateral ST_Transform(ST_Force2D(p.geom), {int(srid)}) u
                 where p.projeto_id = %s order by p.codigo"""),
        "logradouros": ("LINESTRING", ["nome TEXT"], "select ST_AsBinary(geom) g, nome from reurb.logradouro where projeto_id = %s order by nome"),
    }  # fmt: skip
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.unlink(missing_ok=True)
    db = sqlite3.connect(destino)
    db.executescript(
        """pragma application_id = 1196444487; pragma user_version = 10300;
        create table gpkg_spatial_ref_sys (srs_name text not null, srs_id integer primary key, organization text not null,
          organization_coordsys_id integer not null, definition text not null, description text);
        create table gpkg_contents (table_name text primary key, data_type text not null, identifier text unique, description text default '',
          last_change datetime not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')), min_x double, min_y double, max_x double, max_y double, srs_id integer);
        create table gpkg_geometry_columns (table_name text not null, column_name text not null, geometry_type_name text not null,
          srs_id integer not null, z tinyint not null, m tinyint not null, primary key (table_name, column_name));"""
    )
    db.executemany(
        "insert into gpkg_spatial_ref_sys values (?,?,?,?,?,?)",
        [
            ("Undefined Cartesian", -1, "NONE", -1, "undefined", None),
            ("Undefined geographic", 0, "NONE", 0, "undefined", None),
            ("WGS 84", 4326, "EPSG", 4326, CRS.from_epsg(4326).to_wkt("WKT1_GDAL"), None),
            ("SIRGAS 2000", SRS, "EPSG", SRS, CRS.from_epsg(SRS).to_wkt("WKT1_GDAL"), "Geometria canônica do Geo-Fundiário"),
        ],
    )
    for nome, (tipo, colunas, sql) in camadas.items():
        linhas = consulta(sql, pid)
        db.execute(f"create table {nome} (fid integer primary key autoincrement, geom {tipo}, {', '.join(colunas)})")
        geoms = [wkb.loads(bytes(r["g"])) for r in linhas]
        marcas = ",".join("?" * (len(colunas) + 1))
        db.executemany(f"insert into {nome} (geom, {', '.join(c.split()[0] for c in colunas)}) values ({marcas})",
                       [(_blob(g), *list(r.values())[1:]) for g, r in zip(geoms, linhas)])  # fmt: skip
        caixa = [f(v) for f, v in zip((min, min, max, max), zip(*[g.bounds for g in geoms]))] if geoms else [None] * 4
        db.execute("insert into gpkg_contents (table_name, data_type, identifier, min_x, min_y, max_x, max_y, srs_id) values (?,?,?,?,?,?,?,?)",
                   (nome, "features", nome, *caixa, SRS))  # fmt: skip
        db.execute("insert into gpkg_geometry_columns values (?,?,?,?,0,0)", (nome, "geom", tipo, SRS))
    db.commit()
    db.close()
    return destino
