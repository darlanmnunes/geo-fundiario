"""API Geo-Fundiário — FastAPI sobre PostgreSQL/PostGIS (esquemas ladm, reurb, campo)."""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from shapely import wkb

from geo_fundiario import acesso, assistente, diagnostico, documentos, edicao, gpkg
from geo_fundiario.acesso import exigir
from geo_fundiario.banco import cfg, consulta, pool
from geo_fundiario.geodesia import Vertice, memorial_descritivo
from geo_fundiario.instantaneo import confrontantes as nomear_confrontantes
from geo_fundiario.instantaneo import instantaneo, tudo
from geo_fundiario.seguranca import Protecao

Nivel = Literal["nucleo", "quadra", "lote", "edificacao", "unidade_autonoma", "area_publica"]


@asynccontextmanager
async def lifespan(_: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(
    title="Geo-Fundiário API",
    version="0.2.0",
    lifespan=lifespan,
    # Em produção a documentação interativa não é publicada: ela mapeia toda a superfície da API.
    docs_url=None if cfg.producao else "/docs",
    redoc_url=None,
    openapi_url=None if cfg.producao else "/openapi.json",
)
# A ordem importa: o último adicionado é o primeiro a ver a requisição.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cfg.cors_origins.split(",") if o.strip()],
    allow_methods=["GET", "POST", "PUT", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)
app.add_middleware(Protecao)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=[h.strip() for h in cfg.hosts.split(",") if h.strip()])
app.include_router(documentos.router)
app.include_router(assistente.router)
app.include_router(acesso.router)
app.include_router(edicao.router)


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


@app.get("/instantaneo", dependencies=[exigir("leitura")])
def instantaneo_geral():
    """Tudo o que a interface mostra, de todos os núcleos: é o que ela lê quando GEOF_API_URL está definido."""
    return json.loads(json.dumps(tudo(), default=str))


@app.get("/projetos/{projeto_id}/instantaneo", dependencies=[exigir("leitura")])
def instantaneo_projeto(projeto_id: int):
    dados = instantaneo(projeto_id)
    if dados is None:
        raise HTTPException(404, "Projeto não encontrado")
    return json.loads(json.dumps(dados, default=str))


@app.get("/diagnostico/conectores")
def conectores():
    """Catálogo dos temas do diagnóstico territorial e de onde cada um é consultado."""
    return diagnostico.catalogo()


@app.get("/projetos/{projeto_id}/diagnostico", dependencies=[exigir("leitura")])
def diagnostico_ao_vivo(projeto_id: int):
    """Consulta AGORA as fontes ligadas (conectores ao vivo) para o perímetro vigente do núcleo."""
    resultado = diagnostico.diagnosticar(projeto_id)
    if not resultado:
        raise HTTPException(404, "Projeto sem perímetro cadastrado")
    return resultado


@app.post("/projetos/{projeto_id}/diagnostico/gravar")
def diagnostico_gravar(projeto_id: int, usuario: acesso.Usuario | None = exigir("escrita")):
    """Consulta as fontes agora e grava os achados no dossiê do núcleo (alimenta a Inteligência territorial)."""
    resultado = diagnostico.gravar_no_dossie(projeto_id, usuario.email if usuario else None)
    if not resultado:
        raise HTTPException(404, "Projeto sem perímetro cadastrado")
    return resultado


@app.get("/projetos/{projeto_id}/dossie", dependencies=[exigir("leitura")])
def dossie(projeto_id: int):
    """Último dossiê territorial gravado para o núcleo."""
    from geo_fundiario.instantaneo import dossie_do_projeto

    achado = dossie_do_projeto(projeto_id)
    if achado is None:
        raise HTTPException(404, "Núcleo sem dossiê")
    return achado


class AreaDeEstudo(BaseModel):
    """Polígono em GeoJSON (longitude, latitude; SIRGAS 2000 ou WGS 84)."""

    geometria: dict
    uf: str | None = Field(default=None, min_length=2, max_length=2)
    municipio_ibge: str | None = Field(default=None, pattern=r"^\d{7}$")


@app.post("/diagnostico/area", dependencies=[exigir("leitura")])
def diagnostico_de_area(corpo: AreaDeEstudo):
    """Diagnóstico de uma área de estudo livre, sem núcleo cadastrado. Nada é gravado."""
    if len(str(corpo.geometria)) > 400_000:
        raise HTTPException(413, "Geometria grande demais; simplifique o polígono")
    try:
        return diagnostico.diagnosticar_geojson(corpo.geometria, corpo.uf, corpo.municipio_ibge)
    except (ValueError, KeyError, TypeError, AttributeError) as erro:
        raise HTTPException(422, str(erro) if isinstance(erro, ValueError) else "Geometria inválida") from None


@app.get("/projetos/{projeto_id}/geopackage", dependencies=[exigir("leitura")])
def geopackage(projeto_id: int):
    from pathlib import Path

    from fastapi.responses import FileResponse

    if not consulta("select 1 from reurb.projeto where id = %s", projeto_id):
        raise HTTPException(404, "Projeto não encontrado")
    arquivo = gpkg.exportar(projeto_id, Path(cfg.arquivos_dir) / "_exportacoes" / f"nucleo-{projeto_id}.gpkg")
    return FileResponse(arquivo, media_type="application/geopackage+sqlite3", filename=arquivo.name)


@app.get("/projetos/{projeto_id}", dependencies=[exigir("leitura")])
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


@app.get("/projetos/{projeto_id}/camadas/{nivel}", dependencies=[exigir("leitura")])
def camada(projeto_id: int, nivel: Nivel):
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
        "select * from ladm.vw_qualidade_vertice where projeto_id = %s order by atende_dec_9310, erro_posicional_3d_m desc",
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
        """select su.codigo, su.rotulo, q.rotulo quadra, ST_AsBinary(ST_Transform(su.geom, %s)) g
             from ladm.la_spatialunit su left join ladm.la_spatialunit q on q.id = su.parent_id
            where su.projeto_id = %s and su.nivel = 'lote' and su.end_lifespan_version is null""",
        srid,
        lote["projeto_id"],
    )
    ruas = consulta(
        "select nome, ST_AsBinary(ST_Transform(geom, %s)) g from reurb.logradouro where projeto_id = %s",
        srid,
        lote["projeto_id"],
    )
    aguas = consulta(
        "select coalesce(nome, 'Corpo d''água') nome, ST_AsBinary(ST_Transform(geom, %s)) g from reurb.hidrografia where projeto_id = %s",
        srid,
        lote["projeto_id"],
    )
    confr = nomear_confrontantes(
        vertices,
        lote["codigo"],
        [(v["codigo"], f"{v['rotulo']} da {v['quadra']}", wkb.loads(bytes(v["g"]))) for v in vizinhos],
        [(r["nome"], wkb.loads(bytes(r["g"]))) for r in ruas],
        [(r["nome"], wkb.loads(bytes(r["g"]))) for r in aguas],
    )
    return {"lote": lote, "vertices": vertices, "confrontantes": confr}


@app.get("/lotes/{lote_id}/memorial", response_class=PlainTextResponse, dependencies=[exigir("leitura")])
def memorial(lote_id: int):
    d = _dados_memorial(lote_id)
    lote = d["lote"]
    return memorial_descritivo(
        imovel=f"{lote['projeto']}, {lote['rotulo']}, {lote['quadra']}",
        municipio=lote["municipio_nome"],
        uf=lote["uf"],
        vertices=d["vertices"],
        confrontantes=d["confrontantes"],
        srid_utm=lote["srid_utm"],
        responsavel=lote["responsavel_tecnico"],
        art_rrt=lote["art_rrt"],
    )


@app.get("/projetos/{projeto_id}/exportacao-registro", dependencies=[exigir("leitura")])
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
