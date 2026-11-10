"""API Geo-Fundiário — FastAPI sobre PostgreSQL/PostGIS (esquemas ladm, reurb, campo)."""

from __future__ import annotations

import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from shapely import wkb
from shapely.geometry import Point

from geo_fundiario import documentos
from geo_fundiario.banco import cfg, consulta, pool
from geo_fundiario.geodesia import Vertice, memorial_descritivo


@asynccontextmanager
async def lifespan(_: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(title="Geo-Fundiário API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=cfg.cors_origins.split(","), allow_methods=["GET", "POST"], allow_headers=["*"]
)
app.include_router(documentos.router)


@app.get("/saude")
def saude():
    return consulta("select postgis_lib_version() as postgis, now() as agora")[0]


@app.get("/fases")
def fases():
    return consulta("select * from reurb.fase order by ordem")


@app.get("/projetos")
def projetos():
    return consulta(
        """
        select p.id, p.nome, p.modalidade, p.legitimado, p.processo_adm, p.municipio_nome, p.uf, p.situacao,
               (select fase_codigo from reurb.projeto_fase pf join reurb.fase f on f.codigo = pf.fase_codigo
                 where pf.projeto_id = p.id and pf.situacao = 'em_andamento' order by f.ordem limit 1) as fase_atual,
               count(su.id) filter (where su.nivel = 'lote') as lotes,
               count(su.id) filter (where su.nivel = 'quadra') as quadras,
               (select count(*) from campo.cadastro_social cs where cs.projeto_id = p.id) as familias
          from reurb.projeto p
          left join ladm.la_spatialunit su on su.projeto_id = p.id and su.end_lifespan_version is null
         group by p.id order by p.id
        """
    )


@app.get("/projetos/{projeto_id}")
def projeto(projeto_id: int):
    linhas = consulta("select * from reurb.projeto where id = %s", projeto_id)
    if not linhas:
        raise HTTPException(404, "Projeto não encontrado")
    p = linhas[0]
    p["fases"] = consulta(
        """select f.codigo, f.nome, f.tipo, f.base_legal, f.prazo_dias, pf.situacao, pf.iniciada_em, pf.prazo_em, pf.concluida_em
             from reurb.fase f left join reurb.projeto_fase pf on pf.fase_codigo = f.codigo and pf.projeto_id = %s
            order by f.ordem""",
        projeto_id,
    )
    p["notificacoes"] = consulta(
        "select * from reurb.notificacao where projeto_id = %s order by enviada_em", projeto_id
    )
    p["pecas"] = consulta(
        """select pc.*, tp.nome, tp.base_legal from reurb.peca pc join reurb.tipo_peca tp on tp.codigo = pc.tipo
            where projeto_id = %s order by pc.id""",
        projeto_id,
    )
    return p


@app.get("/projetos/{projeto_id}/camadas/{nivel}")
def camada(projeto_id: int, nivel: str):
    """GeoJSON (EPSG:4674 ≈ WGS84 para visualização web) de uma camada do núcleo."""
    linhas = consulta(
        """
        select json_build_object('type', 'FeatureCollection', 'features', coalesce(json_agg(json_build_object(
                 'type', 'Feature', 'id', su.id,
                 'geometry', ST_AsGeoJSON(su.geom, 8)::json,
                 'properties', json_build_object('id', su.id, 'codigo', su.codigo, 'rotulo', su.rotulo,
                                                 'area_m2', su.area_m2, 'perimetro_m', su.perimetro_m,
                                                 'ocupante', pt.nome, 'restricoes', r.restricoes))), '[]'::json)) as fc
          from ladm.la_spatialunit su
          left join ladm.la_rrr rr on rr.baunit_id = su.baunit_id and rr.party_id is not null
          left join ladm.la_party pt on pt.id = rr.party_id
          left join lateral (select json_agg(tipo) restricoes from ladm.la_rrr x
                              where x.baunit_id = su.baunit_id and x.party_id is null) r on true
         where su.projeto_id = %s and su.nivel = %s and su.end_lifespan_version is null
        """,
        projeto_id,
        nivel,
    )
    return linhas[0]["fc"]


@app.get("/projetos/{projeto_id}/qualidade-vertices")
def qualidade(projeto_id: int):
    return consulta(
        "select * from ladm.vw_qualidade_vertice where projeto_id = %s order by atende_dec_9310, erro_esferico_m desc",
        projeto_id,
    )


@app.get("/lotes/{lote_id}/confrontantes")
def confrontantes(lote_id: int):
    return consulta("select * from ladm.fn_confrontantes(%s)", lote_id)


def _dados_memorial(lote_id: int) -> dict:
    lote = consulta(
        """select su.id, su.codigo, su.rotulo, su.projeto_id, p.nome projeto, p.municipio_nome, p.uf, p.srid_utm,
                  p.responsavel_tecnico, p.art_rrt, q.rotulo quadra
             from ladm.la_spatialunit su join reurb.projeto p on p.id = su.projeto_id
             left join ladm.la_spatialunit q on q.id = su.parent_id
            where su.id = %s and su.nivel = 'lote'""",
        lote_id,
    )
    if not lote:
        raise HTTPException(404, "Lote não encontrado")
    lote = lote[0]
    srid = lote["srid_utm"]
    vertices = [
        Vertice(r["codigo"], r["e"], r["n"])
        for r in consulta(
            """select pt.codigo, ST_X(g) e, ST_Y(g) n
                 from ladm.la_spatialunit_point sp join ladm.la_point pt on pt.id = sp.point_id,
                      lateral ST_Transform(ST_Force2D(pt.geom), %s) g
                where sp.spatialunit_id = %s order by sp.ordem""",
            srid,
            lote_id,
        )
    ]
    vizinhos = consulta(
        """select su.id, su.rotulo, q.rotulo quadra, ST_AsBinary(ST_Transform(su.geom, %s)) g
             from ladm.la_spatialunit su left join ladm.la_spatialunit q on q.id = su.parent_id
            where su.projeto_id = %s and su.nivel = 'lote' and su.id <> %s and su.end_lifespan_version is null""",
        srid,
        lote["projeto_id"],
        lote_id,
    )
    ruas = consulta(
        "select nome, ST_AsBinary(ST_Transform(geom, %s)) g from reurb.logradouro where projeto_id = %s",
        srid,
        lote["projeto_id"],
    )
    viz_geom = [(f"{v['rotulo']} da {v['quadra']}", wkb.loads(v["g"])) for v in vizinhos]
    rua_geom = [(r["nome"], wkb.loads(r["g"])) for r in ruas]
    confr = []
    for i, a in enumerate(vertices):
        b = vertices[(i + 1) % len(vertices)]
        meio = Point((a.e + b.e) / 2, (a.n + b.n) / 2)
        nome = next((n for n, g in viz_geom if g.boundary.distance(meio) < 0.05), None)
        if nome is None and rua_geom:
            nome = min(rua_geom, key=lambda r: r[1].distance(meio))[0]
        confr.append(nome or "área não identificada")
    return {"lote": lote, "vertices": vertices, "confrontantes": confr}


@app.get("/lotes/{lote_id}/memorial", response_class=PlainTextResponse)
def memorial(lote_id: int):
    d = _dados_memorial(lote_id)
    lote = d["lote"]
    return memorial_descritivo(
        titulo=f"{lote['rotulo']} — {lote['quadra']}",
        imovel=f"{lote['projeto']}, {lote['rotulo']}, {lote['quadra']}",
        municipio_uf=f"{lote['municipio_nome']}/{lote['uf']}",
        vertices=d["vertices"],
        confrontantes=d["confrontantes"],
        srid_utm=lote["srid_utm"],
        responsavel=lote["responsavel_tecnico"],
        art_rrt=lote["art_rrt"],
    )


@app.get("/projetos/{projeto_id}/exportacao-registro")
def exportacao_registro(projeto_id: int):
    """Pacote estruturado para o Registro de Imóveis (CRF art. 41 + listagem de ocupantes).

    ESBOÇO: o esquema JSON do módulo REURB do ONR ainda não foi verificado; este formato
    é próprio e deve ser mapeado para o leiaute oficial quando publicado.
    """
    p = projeto(projeto_id)
    unidades = consulta(
        """select su.codigo, su.rotulo, su.area_m2, su.perimetro_m, ST_AsText(su.geom) wkt_sirgas2000,
                  pt.nome ocupante, rr.tipo direito
             from ladm.la_spatialunit su
             left join ladm.la_rrr rr on rr.baunit_id = su.baunit_id and rr.party_id is not null
             left join ladm.la_party pt on pt.id = rr.party_id
            where su.projeto_id = %s and su.nivel = 'lote' and su.end_lifespan_version is null
            order by su.codigo""",
        projeto_id,
    )
    return {
        "formato": "geo-fundiario/reurb-registro@0.1 (esboço)",
        "nucleo": p["nome"],
        "localizacao": f"{p['municipio_nome']}/{p['uf']} (IBGE {p['municipio_ibge']})",
        "modalidade": p["modalidade"],
        "unidades": json.loads(json.dumps(unidades, default=str)),
    }
