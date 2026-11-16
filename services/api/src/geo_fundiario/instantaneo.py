"""Instantâneo de um núcleo: tudo o que a interface mostra, lido do banco numa estrutura só.

É a mesma estrutura servida ao vivo por GET /projetos/{id}/instantaneo e gravada em arquivo por
scripts/exportar_instantaneo.py para a demonstração estática. Não há dado que nasça fora do banco.
"""

from __future__ import annotations

from datetime import date

from pyproj import Transformer
from shapely import wkb
from shapely.geometry import Point

from geo_fundiario.banco import consulta
from geo_fundiario.geodesia import (
    Vertice,
    fatores_cartograficos,
    fuso_utm,
    memorial_descritivo,
    meridiano_central,
    segmentos,
)

ALCANCE_LOGRADOURO_M = 40.0


def _iso(v) -> str | None:
    return v.isoformat()[:10] if v else None


def _geometria(gj: dict) -> dict:
    """MultiPolygon de um polígono só vira Polygon: é o caso geral e pesa menos."""
    if gj["type"] == "MultiPolygon" and len(gj["coordinates"]) == 1:
        return {"type": "Polygon", "coordinates": gj["coordinates"][0]}
    return gj


def _feicoes(linhas: list[dict], *props: str) -> dict:
    return {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "geometry": _geometria(r["gj"]), "properties": {k: r[k] for k in props}} for r in linhas
        ],
    }


def confrontantes(vertices: list[Vertice], proprio: str, vizinhos: list, ruas: list, aguas: list) -> list[str]:
    """Para cada lado (vértice i → i+1), quem está do outro lado: unidade vizinha, logradouro ou corpo d'água."""
    nomes = []
    for i, a in enumerate(vertices):
        b = vertices[(i + 1) % len(vertices)]
        meio = Point((a.e + b.e) / 2, (a.n + b.n) / 2)
        nome = next((n for cod, n, g in vizinhos if cod != proprio and g.boundary.distance(meio) < 0.05), None)
        if nome is None:
            perto = [(g.distance(meio), n) for n, g in ruas] + [(g.distance(meio), f"margem ({n})") for n, g in aguas]
            dist, cand = min(perto, default=(None, None))
            nome = cand if dist is not None and dist <= ALCANCE_LOGRADOURO_M else "área livre do núcleo"
        nomes.append(nome)
    return nomes


def plano_local(lon0: float, lat0: float, h0: float):
    """Sistema Geodésico Local: plano topográfico tangente em (lon0, lat0, h0), eixos E/N/U (NBR 14166).

    Devolve uma função (lon, lat, h) -> (e, n) em metros. É onde a NBR 17047 manda calcular áreas e
    distâncias de levantamento cadastral: sem a deformação da projeção UTM.
    """
    t = Transformer.from_pipeline(
        "+proj=pipeline +step +proj=unitconvert +xy_in=deg +xy_out=rad +step +proj=cart +ellps=GRS80 "
        f"+step +proj=topocentric +ellps=GRS80 +lon_0={lon0} +lat_0={lat0} +h_0={h0}"
    )
    return lambda lon, lat, h: t.transform(lon, lat, h)[:2]


def _area_perimetro(pts: list[tuple[float, float]]) -> tuple[float, float]:
    area = abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))) / 2
    per = sum(((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5 for a, b in zip(pts, pts[1:] + pts[:1]))
    return area, per


def listar_ids() -> list[int]:
    return [r["id"] for r in consulta("select id from reurb.projeto order by id")]


def dossie_do_projeto(pid: int) -> dict | None:
    """Último dossiê territorial gravado para o núcleo, com os achados na ordem do catálogo."""
    dossie = consulta("select id, resumo, pontuacao, gerado_em from inteligencia.dossie where projeto_id = %s order by id desc limit 1", pid)
    dossie_json = None
    if dossie:
        dossie_json = {
            "resumo": dossie[0]["resumo"],
            "pontuacao": dossie[0]["pontuacao"],
            "achados": consulta(
                """select a.camada_codigo codigo, coalesce(c.nome, a.camada_nome) camada, coalesce(c.fontes_descricao, '') fonte, a.resultado, a.severidade,
                          a.implicacao, a.base_legal base, a.origem, a.metricas->>'consultado_em' consultado_em
                     from inteligencia.achado a left join inteligencia.camada c on c.codigo = a.camada_codigo
                    where a.dossie_id = %s order by c.ordem, a.id""",
                dossie[0]["id"],
            ),
        }
    return dossie_json


def instantaneo(pid: int) -> dict | None:
    base = consulta("select * from reurb.projeto where id = %s", pid)
    if not base:
        return None
    p = base[0]
    srid = p["srid_utm"]

    fases = consulta(
        """select f.codigo, coalesce(pf.situacao, 'pendente') situacao, pf.iniciada_em, pf.concluida_em, pf.prazo_em
             from reurb.fase f left join reurb.projeto_fase pf on pf.fase_codigo = f.codigo and pf.projeto_id = %s
            order by f.ordem""",
        pid,
    )
    for f in fases:
        for k in ("iniciada_em", "concluida_em", "prazo_em"):
            f[k] = _iso(f[k])
    atual = next((f["codigo"] for f in fases if f["situacao"] == "em_andamento"), fases[-1]["codigo"])

    lev = consulta("select * from campo.levantamento where projeto_id = %s order by id limit 1", pid)
    lev = lev[0] if lev else {}

    nuc = consulta(
        """select ST_AsGeoJSON(geom, 8)::json gj, area_m2, ST_X(c) lon, ST_Y(c) lat,
                  ST_AsBinary(ST_Transform(geom, %s)) g
             from ladm.la_spatialunit, lateral ST_Centroid(geom) c
            where projeto_id = %s and nivel = 'nucleo' and end_lifespan_version is null""",
        srid,
        pid,
    )[0]
    quadras = consulta(
        """select codigo, ST_AsGeoJSON(geom, 8)::json gj from ladm.la_spatialunit
            where projeto_id = %s and nivel = 'quadra' and end_lifespan_version is null order by codigo""",
        pid,
    )
    ruas = consulta(
        "select nome, ST_AsGeoJSON(geom, 8)::json gj, ST_AsBinary(ST_Transform(geom, %s)) g from reurb.logradouro where projeto_id = %s order by nome, id",
        srid,
        pid,
    )
    aguas = consulta(
        "select coalesce(nome, 'Corpo d''água') nome, ST_AsGeoJSON(geom, 8)::json gj, ST_AsBinary(ST_Transform(geom, %s)) g from reurb.hidrografia where projeto_id = %s order by id",
        srid,
        pid,
    )
    faixa = consulta(
        """select ST_AsGeoJSON(ST_Transform(ST_Intersection(ST_Buffer(ST_Union(ST_Transform(h.geom, %s)), 30),
                                                           ST_Buffer(ST_Transform(n.geom, %s), 40)), 4674), 8)::json gj
             from reurb.hidrografia h join ladm.la_spatialunit n on n.projeto_id = h.projeto_id and n.nivel = 'nucleo'
            where h.projeto_id = %s group by n.geom""",
        srid,
        srid,
        pid,
    )
    ruas_g = [(r["nome"], wkb.loads(bytes(r["g"]))) for r in ruas]
    aguas_g = [(r["nome"], wkb.loads(bytes(r["g"]))) for r in aguas]

    lotes = consulta(
        """select su.id, su.codigo, su.rotulo, q.codigo quadra, su.area_m2, su.perimetro_m,
                  ST_AsGeoJSON(su.geom, 8)::json gj, ST_AsBinary(ST_Transform(su.geom, %s)) g, us.situacao,
                  pt.id party_id, pt.nome, pt.cpf_cnpj, pt.data_nascimento,
                  cs.composicao_familiar, cs.renda_familiar, cs.tempo_ocupacao_anos, cs.uso_imovel,
                  cs.possui_outro_imovel, cs.pcd, cs.escolaridade, cs.situacao_profissional, cs.coletado_em
             from ladm.la_spatialunit su
             left join ladm.la_spatialunit q on q.id = su.parent_id
             left join reurb.unidade_situacao us on us.spatialunit_id = su.id and us.end_lifespan_version is null
             left join campo.cadastro_social cs on cs.spatialunit_id = su.id
             left join ladm.la_party pt on pt.id = cs.party_id
            where su.projeto_id = %s and su.nivel = 'lote' and su.end_lifespan_version is null
            order by su.codigo""",
        srid,
        pid,
    )
    pontos: dict[int, list[dict]] = {}
    for r in consulta(
        """select sp.spatialunit_id, pt.codigo, pt.tipo, pt.metodo, pt.sigma_e, pt.sigma_n, pt.sigma_h,
                  ST_X(g) e, ST_Y(g) n, ST_Z(pt.geom) h, ST_X(pt.geom) lon, ST_Y(pt.geom) lat
             from ladm.la_spatialunit_point sp
             join ladm.la_point pt on pt.id = sp.point_id
             join ladm.la_spatialunit su on su.id = sp.spatialunit_id,
                  lateral ST_Transform(ST_Force2D(pt.geom), %s) g
            where su.projeto_id = %s order by sp.spatialunit_id, sp.ordem""",
        srid,
        pid,
    ):
        pontos.setdefault(r["spatialunit_id"], []).append(r)

    docs_de: dict[tuple[str, str], list[str]] = {}
    arquivos_de: dict[tuple[str, str], list[dict]] = {}
    for r in consulta(
        """select v.entidade, v.entidade_id, d.id, d.tipo, d.titulo, d.nome_arquivo, d.mime, d.tamanho_bytes, d.criado_em, d.codigo_verificacao
             from documentos.documento d join documentos.vinculo v on v.documento_id = d.id
            where d.projeto_id = %s and d.situacao = 'ativo' and v.entidade in ('party', 'spatialunit')
            order by d.tipo""",
        pid,
    ):
        chave = (r["entidade"], r["entidade_id"])
        docs_de.setdefault(chave, []).append(r["tipo"])
        arquivos_de.setdefault(chave, []).append(
            {"id": str(r["id"]), "tipo": r["tipo"], "titulo": r["titulo"], "nome_arquivo": r["nome_arquivo"], "mime": r["mime"],
             "tamanho_kb": round(r["tamanho_bytes"] / 1024), "data": _iso(r["criado_em"]), "codigo_verificacao": r["codigo_verificacao"]}
        )  # fmt: skip
    norma = consulta(
        """select n.code, n.descricao, n.base_legal, n.componente, n.aplicacao, coalesce(pr.tolerancia_posicional_m, n.tolerancia_m)::float tolerancia_m
             from reurb.projeto pr join ladm.cl_norma_precisao n on n.code = pr.norma_precisao where pr.id = %s""",
        pid,
    )[0]
    todos_pts = [r for lista in pontos.values() for r in lista]
    h_medio = sum(r["h"] for r in todos_pts) / len(todos_pts) if todos_pts else 0.0
    local = plano_local(nuc["lon"], nuc["lat"], h_medio)
    exigidos = [
        r["tipo"]
        for r in consulta(
            """select tipo from documentos.exigencia
                where entidade = 'party' and obrigatorio and (modalidade is null or modalidade = %s) order by id""",
            p["modalidade"],
        )
    ]
    pend_de: dict[int, list[str]] = {}
    for r in consulta(
        "select spatialunit_id, descricao from reurb.pendencia where projeto_id = %s and resolvida_em is null order by id",
        pid,
    ):
        pend_de.setdefault(r["spatialunit_id"], []).append(r["descricao"])

    vizinhos_g = [(lt["codigo"], f"{lt['rotulo']} da Quadra {(lt['quadra'] or 'Q')[1:]}", wkb.loads(bytes(lt["g"]))) for lt in lotes]
    data_pecas = lev.get("data_fim")
    referencia = lev.get("data_fim") or date.today()
    feicoes_lotes = []
    for lt in lotes:
        vs = [Vertice(r["codigo"], round(r["e"], 3), round(r["n"], 3)) for r in pontos.get(lt["id"], [])]
        confr = confrontantes(vs, lt["codigo"], vizinhos_g, ruas_g, aguas_g)
        numero = int(lt["codigo"].split("-L")[-1])
        quadra = int((lt["quadra"] or "Q0")[1:])
        ocupante = None
        if lt["party_id"]:
            tem = docs_de.get(("party", str(lt["party_id"])), []) + docs_de.get(("spatialunit", str(lt["id"])), [])
            renda = float(lt["renda_familiar"] or 0)
            cpf = lt["cpf_cnpj"] or ""
            nasc = lt["data_nascimento"]
            ocupante = {
                "nome": lt["nome"],
                "cpf_mascarado": f"***.{cpf[3:6]}.{cpf[6:9]}-**" if len(cpf) == 11 else "—",
                "renda_familiar": renda,
                "renda_sm": round(renda / 1518.0, 1),
                "composicao_familiar": lt["composicao_familiar"],
                "tempo_ocupacao_anos": float(lt["tempo_ocupacao_anos"] or 0),
                "uso": lt["uso_imovel"],
                "pcd": bool(lt["pcd"]),
                "possui_outro_imovel": bool(lt["possui_outro_imovel"]),
                "idade": referencia.year - nasc.year - ((referencia.month, referencia.day) < (nasc.month, nasc.day)) if nasc else None,
                "escolaridade": lt["escolaridade"],
                "situacao_profissional": lt["situacao_profissional"],
                "documentos": sorted(set(tem)),
                "documentos_pendentes": [d for d in exigidos if d not in tem],
            }
        segs = segmentos(vs, confr)
        area_sgl, per_sgl = _area_perimetro([local(r["lon"], r["lat"], r["h"]) for r in pontos.get(lt["id"], [])]) if pontos.get(lt["id"]) else (0.0, 0.0)
        if ocupante:
            ocupante["arquivos"] = arquivos_de.get(("party", str(lt["party_id"])), []) + arquivos_de.get(("spatialunit", str(lt["id"])), [])
        feicoes_lotes.append(
            {
                "type": "Feature",
                "geometry": _geometria(lt["gj"]),
                "properties": {
                    "id": lt["id"],
                    "codigo": lt["codigo"],
                    "quadra": quadra,
                    "numero": numero,
                    "area_m2": float(lt["area_m2"]),
                    "perimetro_m": float(lt["perimetro_m"]),
                    "area_sgl_m2": round(area_sgl, 2),
                    "perimetro_sgl_m": round(per_sgl, 2),
                    "situacao": lt["situacao"] or "levantado",
                    "ocupante": ocupante,
                    "pendencias": pend_de.get(lt["id"], []),
                    "vertices": [
                        {
                            "codigo": r["codigo"],
                            "e": round(r["e"], 3),
                            "n": round(r["n"], 3),
                            "h": round(r["h"], 3),
                            "tipo": r["tipo"],
                            "metodo": r["metodo"],
                            "sigma_e": float(r["sigma_e"] or 0),
                            "sigma_n": float(r["sigma_n"] or 0),
                            "sigma_h": float(r["sigma_h"] or 0),
                        }
                        for r in pontos.get(lt["id"], [])
                    ],
                    "segmentos": [
                        {
                            "de": s.de.codigo,
                            "para": s.para.codigo,
                            "azimute": round(s.azimute_graus, 6),
                            "distancia": round(s.distancia_m, 3),
                            "confrontante": s.confrontante,
                        }
                        for s in segs
                    ],
                    "memorial": memorial_descritivo(
                        imovel=f"{p['nome']}, Lote {numero:02d}, Quadra {quadra:02d}",
                        municipio=p["municipio_nome"],
                        uf=p["uf"],
                        vertices=vs,
                        confrontantes=confr,
                        srid_utm=srid,
                        titular=ocupante and ocupante["nome"],
                        responsavel=p["responsavel_tecnico"],
                        art_rrt=p["art_rrt"],
                        data=data_pecas,
                    ),
                },
            }
        )

    anel = list(wkb.loads(bytes(nuc["g"])).geoms[0].exterior.coords)[:-1]
    i0 = max(range(len(anel)), key=lambda i: (anel[i][1], -anel[i][0]))
    perim_v = [Vertice(f"V-{i + 1:03d}", round(e, 3), round(n, 3)) for i, (e, n) in enumerate(anel[i0:] + anel[:i0])]
    memorial_perimetro = memorial_descritivo(
        imovel=f"Perímetro do {p['nome']}",
        municipio=p["municipio_nome"],
        uf=p["uf"],
        vertices=perim_v,
        confrontantes=confrontantes(perim_v, "", [], ruas_g, aguas_g),
        srid_utm=srid,
        titular=p["legitimado"],
        rotulo_titular="REQUERENTE",
        responsavel=p["responsavel_tecnico"],
        art_rrt=p["art_rrt"],
        data=data_pecas,
    )

    notificacoes = consulta(
        """select destinatario_nome destinatario, papel, meio, enviada_em, recebida_em, prazo_fim, resposta,
                  impugnacao_resumo impugnacao from reurb.notificacao where projeto_id = %s order by enviada_em, id""",
        pid,
    )
    for n in notificacoes:
        for k in ("enviada_em", "recebida_em", "prazo_fim"):
            n[k] = _iso(n[k])

    assinaturas: dict[str, list[dict]] = {}
    for a in consulta(
        """select a.documento_id, a.signatario_nome nome, a.papel, a.metodo, a.situacao, a.assinado_em em
             from documentos.assinatura a join documentos.documento d on d.id = a.documento_id
            where d.projeto_id = %s order by a.id""",
        pid,
    ):
        assinaturas.setdefault(str(a.pop("documento_id")), []).append({**a, "em": _iso(a["em"])})
    documentos = [
        {
            "id": str(d["id"]),
            "fase": d["fase"],
            "tipo": d["tipo"],
            "titulo": d["titulo"],
            "data": d["metadados"].get("data_documento") or _iso(d["criado_em"]),
            "paginas": d["metadados"].get("paginas", 1),
            "tamanho_kb": round(d["tamanho_bytes"] / 1024),
            "codigo_verificacao": d["codigo_verificacao"],
            "origem": "emitido" if d["origem"] == "emitido" else "upload",
            "assinaturas": assinaturas.get(str(d["id"]), []),
        }
        for d in consulta(
            """select d.id, d.tipo, d.titulo, d.tamanho_bytes, d.codigo_verificacao, d.origem, d.metadados, d.criado_em,
                      split_part(v.entidade_id, ':', 2) fase
                 from documentos.documento d
                 join documentos.vinculo v on v.documento_id = d.id and v.entidade = 'projeto_fase'
                where d.projeto_id = %s and d.situacao = 'ativo'
                order by d.metadados->>'data_documento', d.titulo""",
            pid,
        )
    ]

    dossie_json = dossie_do_projeto(pid)

    return {
        "id": p["id"],
        "nome": p["nome"],
        "modalidade": p["modalidade"],
        "legitimado": p["legitimado"],
        "processo_adm": p["processo_adm"],
        "municipio": p["municipio_nome"],
        "uf": p["uf"],
        "municipio_ibge": p["municipio_ibge"],
        "srid_utm": srid,
        "responsavel_tecnico": p["responsavel_tecnico"],
        "art_rrt": p["art_rrt"],
        "fase_atual": atual,
        "fases": fases,
        "levantamento": {
            "equipamento": lev.get("equipamento"),
            "norma": lev.get("norma"),
            "data_inicio": _iso(lev.get("data_inicio")),
            "data_fim": _iso(lev.get("data_fim")),
        },
        "precisao": norma,
        "plano_calculo": p["plano_calculo"],
        "cartografia": {
            "altitude_media": round(h_medio, 1),
            "fuso": fuso_utm(srid),
            "meridiano_central": meridiano_central(srid),
            "lon": round(nuc["lon"], 6),
            "lat": round(nuc["lat"], 6),
            **fatores_cartograficos(srid, nuc["lon"], nuc["lat"]),
        },
        "area_nucleo_m2": float(nuc["area_m2"]),
        "perimetro": {"type": "Feature", "geometry": _geometria(nuc["gj"]), "properties": {}},
        "memorial_perimetro": memorial_perimetro,
        "quadras": _feicoes(quadras, "codigo"),
        "logradouros": _feicoes(ruas, "nome"),
        "hidrografia": _feicoes(aguas, "nome"),
        "faixa_app": faixa[0]["gj"] if faixa and faixa[0]["gj"] else None,
        "lotes": {"type": "FeatureCollection", "features": feicoes_lotes},
        "notificacoes": notificacoes,
        "pecas": consulta("select tipo, situacao from reurb.peca where projeto_id = %s and situacao <> 'substituida' order by id", pid),
        "documentos": documentos,
        "dossie": dossie_json,
    }


def catalogo_camadas() -> list[dict]:
    return consulta(
        """select c.codigo, c.nome, c.fontes_descricao fonte, c.base_legal base, c.conector, c.endpoint, c.situacao_conector situacao,
                  c.observacao, f.orgao, f.licenca
             from inteligencia.camada c left join inteligencia.fonte f on f.codigo = c.fonte_codigo order by c.ordem"""
    )


def tudo() -> dict:
    """Pacote completo da demonstração: todos os núcleos e o catálogo de camadas."""
    carimbo = consulta("select max(ocorrido_em) em from auditoria.evento")[0]["em"]
    return {
        "aviso": "Dados fictícios de demonstração sobre geometria do OpenStreetMap (ODbL)",
        "origem": "banco geo_fundiario (PostgreSQL/PostGIS)",
        "ultima_alteracao": carimbo.isoformat(timespec="seconds") if carimbo else None,
        "camadas": catalogo_camadas(),
        "projetos": [instantaneo(i) for i in listar_ids()],
    }
