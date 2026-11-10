"""Gera dados FICTÍCIOS de demonstração: núcleos, quadras, lotes, vértices, ocupantes.

Uma única fonte alimenta o banco (db/seed/seed.sql) e o modo offline do front-end
(apps/web/src/data/seed.json). Nomes, rendas e situações são inventados.

    uv run python scripts/gerar_seed.py
"""

from __future__ import annotations

import hashlib
import json
import math
import random
import uuid
from pathlib import Path

import shapely
from pyproj import Transformer
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, mapping
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

from geo_fundiario.geodesia import Vertice, area_shoelace, memorial_descritivo, segmentos

RAIZ = Path(__file__).resolve().parents[3]
SRID_UTM = 31983  # SIRGAS 2000 / UTM 23S
para_utm = Transformer.from_crs(4674, SRID_UTM, always_xy=True).transform
para_geo = Transformer.from_crs(SRID_UTM, 4674, always_xy=True).transform

NOMES = [
    "Maria",
    "José",
    "Ana",
    "João",
    "Antônia",
    "Francisco",
    "Luzia",
    "Sebastião",
    "Aparecida",
    "Geraldo",
    "Rita",
    "Raimundo",
    "Conceição",
    "Pedro",
    "Helena",
    "Joaquim",
    "Fátima",
    "Paulo",
    "Lúcia",
    "Benedito",
    "Rosa",
    "Marcos",
    "Sandra",
    "Luiz",
    "Cláudia",
    "Wellington",
    "Jéssica",
    "Adriano",
    "Simone",
    "Edson",
]
SOBRENOMES = [
    "Silva",
    "Santos",
    "Oliveira",
    "Souza",
    "Pereira",
    "Costa",
    "Rodrigues",
    "Almeida",
    "Nascimento",
    "Lima",
    "Araújo",
    "Fernandes",
    "Carvalho",
    "Gomes",
    "Martins",
    "Rocha",
    "Ribeiro",
    "Alves",
    "Barbosa",
    "Teixeira",
]
SALARIO_MINIMO = 1518.00
NS = uuid.UUID("6f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d")  # namespace fixo: ids determinísticos
NOME_DOC = {
    "rg": "Documento de identidade",
    "cpf": "CPF",
    "certidao_casamento": "Certidão de casamento/união estável",
    "comprovante_renda": "Comprovante de renda",
    "comprovante_residencia": "Comprovante de residência",
    "declaracao_nao_proprietario": "Declaração de não possuir outro imóvel",
    "foto_fachada": "Foto da fachada",
}

FASES = [
    "diagnostico",
    "requerimento",
    "classificacao",
    "levantamento",
    "notificacao",
    "projeto",
    "saneamento",
    "aprovacao",
    "crf",
    "registro",
]


def nucleo(cfg: dict, rnd: random.Random) -> dict:
    """Monta quadras de 2 fileiras de lotes, com vértices compartilhados (topologia exata)."""
    e0, n0 = para_utm(cfg["lon"], cfg["lat"])
    rua, prof = 12.0, 25.0
    ang = math.radians(cfg["rotacao"])
    vert_id = 0
    pontos: dict[tuple, Vertice] = {}
    pontos_meta: dict[str, dict] = {}

    def local_para_utm(x: float, y: float) -> tuple[float, float]:
        return (
            e0 + x * math.cos(ang) - y * math.sin(ang),
            n0 + x * math.sin(ang) + y * math.cos(ang),
        )

    def vertice(chave: tuple, x: float, y: float, canto: bool) -> Vertice:
        nonlocal vert_id
        if chave not in pontos:
            vert_id += 1
            jx, jy = rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6)
            e, n = local_para_utm(x + jx, y + jy)
            tipo = "M" if canto else "P"
            cod = f"{cfg['sigla']}-{tipo}-{vert_id:04d}"
            pontos[chave] = Vertice(cod, round(e, 3), round(n, 3))
            pontos_meta[cod] = {
                "tipo": tipo,
                "metodo": "gnss_rtk" if canto else "estacao_total",
                "sigma": round(rnd.uniform(0.012, 0.035), 3) if canto else round(rnd.uniform(0.015, 0.042), 3),
            }
        return pontos[chave]

    quadras, lotes = [], []
    x_cursor = 0.0
    for qi, ncols in enumerate(cfg["quadras"]):
        larguras = [rnd.choice([9.0, 10.0, 10.0, 11.0, 12.0]) for _ in range(ncols)]
        xs = [x_cursor]
        for w in larguras:
            xs.append(xs[-1] + w)
        ys = [0.0, prof, 2 * prof]
        lotes_q = []
        for linha in range(2):
            for c in range(ncols):

                def canto(i, j, n=ncols):
                    return (i in (0, n)) and (j in (0, 2))

                cantos = [
                    (c, linha),
                    (c + 1, linha),
                    (c + 1, linha + 1),
                    (c, linha + 1),
                ]
                vs = [vertice((qi, i, j), xs[i], ys[j], canto(i, j)) for i, j in cantos]
                num = c + 1 if linha == 1 else 2 * ncols - c
                lotes_q.append({"quadra": qi + 1, "numero": num, "vertices": vs})
        quadra_poly = unary_union([Polygon([(v.e, v.n) for v in lt["vertices"]]) for lt in lotes_q])
        quadras.append({"codigo": f"Q{qi + 1:02d}", "poly": quadra_poly})
        lotes += lotes_q
        x_cursor = xs[-1] + rua

    largura_total = x_cursor - rua
    # Eixos dos logradouros, no referencial local antes da rotação
    eixos_locais = {
        "Rua das Acácias": [
            (-rua / 2, 2 * prof + rua / 2),
            (largura_total + rua / 2, 2 * prof + rua / 2),
        ],
        "Rua dos Ipês": [(-rua / 2, -rua / 2), (largura_total + rua / 2, -rua / 2)],
        "Avenida Central": [(-rua / 2, -rua / 2), (-rua / 2, 2 * prof + rua / 2)],
        cfg["rua_leste"]: [
            (largura_total + rua / 2, -rua / 2),
            (largura_total + rua / 2, 2 * prof + rua / 2),
        ],
    }
    # Travessas entre quadras: eixo a meia rua do limite leste de cada quadra (referencial local)
    for qi in range(len(quadras) - 1):
        xs_local = [(e - e0) * math.cos(ang) + (n - n0) * math.sin(ang) for e, n in quadras[qi]["poly"].exterior.coords]
        xm = max(xs_local) + rua / 2
        eixos_locais[f"Travessa {qi + 1}"] = [(xm, -rua / 2), (xm, 2 * prof + rua / 2)]
    logradouros = {nome: LineString([local_para_utm(x, y) for x, y in pts]) for nome, pts in eixos_locais.items()}

    perimetro = orient(
        unary_union([q["poly"] for q in quadras]).buffer(rua, join_style=2).simplify(0.01),
        sign=-1.0,
    )
    return {
        "lotes": lotes,
        "quadras": quadras,
        "logradouros": logradouros,
        "perimetro": perimetro,
        "pontos_meta": pontos_meta,
        "srid": SRID_UTM,
        "eixo_leste": cfg["rua_leste"],
    }


def ordenar_horario(vs: list[Vertice]) -> list[Vertice]:
    """Sentido horário, iniciando no vértice mais ao norte (convenção usual de memorial)."""
    poly = orient(Polygon([(v.e, v.n) for v in vs]), sign=-1.0)
    por_coord = {(v.e, v.n): v for v in vs}
    anel = [por_coord[c] for c in list(poly.exterior.coords)[:-1]]
    i0 = max(range(len(anel)), key=lambda i: (anel[i].n, -anel[i].e))
    return anel[i0:] + anel[:i0]


def confrontante_de(
    seg_a: Vertice,
    seg_b: Vertice,
    lote_codigo: str,
    lotes_poly: dict,
    logradouros: dict,
) -> str:
    meio = Point((seg_a.e + seg_b.e) / 2, (seg_a.n + seg_b.n) / 2)
    for cod, (poly, rotulo) in lotes_poly.items():
        if cod != lote_codigo and poly.exterior.distance(meio) < 0.05:
            return rotulo
    nome = min(logradouros, key=lambda k: logradouros[k].distance(meio))
    return nome


def geo(geom):
    return shapely.transform(geom, lambda xy: __import__("numpy").column_stack(para_geo(xy[:, 0], xy[:, 1])))


def wkt_geo(geom) -> str:
    g = geo(geom)
    if isinstance(g, Polygon):
        g = MultiPolygon([g])
    return g.wkt


def sql_txt(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


PROJETOS = [
    {
        "id": 1,
        "nome": "Núcleo Vila Esperança",
        "sigla": "VES",
        "modalidade": "reurb_s",
        "legitimado": "Município de Viçosa",
        "processo": "2026.0142-REURB-S",
        "lon": -42.8712,
        "lat": -20.7638,
        "rotacao": 14.0,
        "quadras": [5, 6, 5],
        "rua_leste": "Rua do Córrego",
        "fase_atual": "projeto",
        "responsavel": "Eng. Agrimensor (exemplo) — CREA-MG 000000/D",
        "art": "MG20260000000",
        "inicio": "2026-02-09",
        "seed": 7,
    },
    {
        "id": 2,
        "nome": "Núcleo Recanto do Sol",
        "sigla": "RSO",
        "modalidade": "reurb_e",
        "legitimado": "Associação de Moradores do Recanto do Sol",
        "processo": "2026.0311-REURB-E",
        "lon": -42.8901,
        "lat": -20.7522,
        "rotacao": -8.0,
        "quadras": [4, 4],
        "rua_leste": "Rua Projetada A",
        "fase_atual": "levantamento",
        "responsavel": "Eng. Cartógrafo (exemplo) — CREA-MG 000001/D",
        "art": "MG20260000001",
        "inicio": "2026-07-20",
        "seed": 11,
    },
]


def gerar():
    sql: list[str] = [
        "-- Gerado por services/api/scripts/gerar_seed.py — DADOS FICTÍCIOS",
        "begin;",
    ]
    saida_json = {"aviso": "Dados fictícios de demonstração", "projetos": []}
    from datetime import date, timedelta

    for cfg in PROJETOS:
        rnd = random.Random(cfg["seed"])
        nuc = nucleo(cfg, rnd)
        pid = cfg["id"]
        sql.append(
            "insert into reurb.projeto (id, nome, processo_adm, modalidade, legitimado, municipio_ibge, municipio_nome, uf, "
            "srid_utm, responsavel_tecnico, art_rrt) overriding system value values "
            f"({pid}, {sql_txt(cfg['nome'])}, {sql_txt(cfg['processo'])}, {sql_txt(cfg['modalidade'])}, "
            f"{sql_txt(cfg['legitimado'])}, '3171303', 'Viçosa', 'MG', {SRID_UTM}, {sql_txt(cfg['responsavel'])}, {sql_txt(cfg['art'])});"
        )

        # Fases --------------------------------------------------------------
        inicio = date.fromisoformat(cfg["inicio"])
        idx_atual = FASES.index(cfg["fase_atual"])
        fases_json = []
        cursor = inicio
        duracoes = {
            "diagnostico": 21,
            "requerimento": 10,
            "classificacao": 35,
            "levantamento": 60,
            "notificacao": 45,
            "projeto": 75,
            "saneamento": 30,
            "aprovacao": 20,
            "crf": 15,
            "registro": 30,
        }
        prazos_legais = {"classificacao": 180, "notificacao": 30}
        for i, f in enumerate(FASES):
            situ = "concluida" if i < idx_atual else ("em_andamento" if i == idx_atual else "pendente")
            ini = cursor if i <= idx_atual else None
            fim = cursor + timedelta(days=duracoes[f]) if i < idx_atual else None
            prazo = (ini + timedelta(days=prazos_legais[f])) if (ini and f in prazos_legais) else None
            if i < idx_atual:
                cursor = fim
            fases_json.append(
                {
                    "codigo": f,
                    "situacao": situ,
                    "iniciada_em": ini and ini.isoformat(),
                    "concluida_em": fim and fim.isoformat(),
                    "prazo_em": prazo and prazo.isoformat(),
                }
            )
            sql.append(
                "insert into reurb.projeto_fase (projeto_id, fase_codigo, situacao, iniciada_em, prazo_em, concluida_em) values "
                f"({pid}, '{f}', '{situ}', {sql_txt(ini and ini.isoformat())}, {sql_txt(prazo and prazo.isoformat())}, {sql_txt(fim and fim.isoformat())});"
            )

        # Levantamento ---------------------------------------------------------
        lev_id = pid
        sql.append(
            "insert into campo.levantamento (id, projeto_id, tipo, equipamento, data_inicio, data_fim, responsavel, art_rrt, norma) "
            f"overriding system value values ({lev_id}, {pid}, 'topografico', 'Receptor GNSS RTK L1/L2 + estação total 2\"', "
            f"'{(inicio + timedelta(days=66)).isoformat()}', '{(inicio + timedelta(days=100)).isoformat()}', "
            f"{sql_txt(cfg['responsavel'])}, {sql_txt(cfg['art'])}, 'ABNT NBR 13133:2021; ABNT NBR 17047:2022');"
        )

        # Núcleo, quadras, logradouros ---------------------------------------------
        sql.append(
            "insert into ladm.la_spatialunit (projeto_id, nivel, codigo, rotulo, geom) values "
            f"({pid}, 'nucleo', 'NUCLEO', {sql_txt(cfg['nome'])}, ST_GeomFromText('{wkt_geo(nuc['perimetro'])}', 4674));"
        )
        for q in nuc["quadras"]:
            sql.append(
                "insert into ladm.la_spatialunit (projeto_id, nivel, codigo, rotulo, geom, parent_id) values "
                f"({pid}, 'quadra', '{q['codigo']}', 'Quadra {q['codigo'][1:]}', ST_GeomFromText('{wkt_geo(q['poly'])}', 4674), "
                f"(select id from ladm.la_spatialunit where projeto_id={pid} and nivel='nucleo'));"
            )
        for nome, linha in nuc["logradouros"].items():
            sql.append(
                f"insert into reurb.logradouro (projeto_id, nome, geom) values ({pid}, {sql_txt(nome)}, "
                f"ST_GeomFromText('{geo(linha).wkt}', 4674));"
            )

        # Vértices ---------------------------------------------------------------
        todos_v = {v.codigo: v for lt in nuc["lotes"] for v in lt["vertices"]}
        for cod, v in todos_v.items():
            meta = nuc["pontos_meta"][cod]
            lon, lat = para_geo(v.e, v.n)
            alt = round(648 + rnd.uniform(-4, 4), 3)
            sql.append(
                "insert into ladm.la_point (projeto_id, codigo, tipo, metodo, geom, sigma_e, sigma_n, sigma_h, levantamento_id, medido_em) values "
                f"({pid}, '{cod}', '{meta['tipo']}', '{meta['metodo']}', ST_SetSRID(ST_MakePoint({lon:.9f}, {lat:.9f}, {alt}), 4674), "
                f"{meta['sigma']}, {meta['sigma']}, {round(meta['sigma'] * 1.6, 3)}, {lev_id}, '{(inicio + timedelta(days=80)).isoformat()}');"
            )

        # Lotes, ocupantes, cadastro social ------------------------------------------
        lotes_poly = {}
        for lt in nuc["lotes"]:
            cod = f"Q{lt['quadra']:02d}-L{lt['numero']:02d}"
            lt["codigo"] = cod
            lt["ordem"] = ordenar_horario(lt["vertices"])
            lotes_poly[cod] = (
                Polygon([(v.e, v.n) for v in lt["ordem"]]),
                f"Lote {lt['numero']:02d} da Quadra {lt['quadra']:02d}",
            )

        situacoes = [
            "apto_crf",
            "apto_crf",
            "cadastrado",
            "cadastrado",
            "notificado",
            "pendencia",
            "levantado",
        ]
        if cfg["fase_atual"] == "levantamento":
            situacoes = ["levantado", "levantado", "cadastrado", "pendencia"]
        features_lotes, ocupantes, notifs = [], [], []
        party_seq = 0
        for lt in nuc["lotes"]:
            cod = lt["codigo"]
            ordem = lt["ordem"]
            confr = [
                confrontante_de(a, ordem[(i + 1) % len(ordem)], cod, lotes_poly, nuc["logradouros"])
                for i, a in enumerate(ordem)
            ]
            vazio = rnd.random() < 0.08
            situ = "levantado" if vazio else rnd.choice(situacoes)
            perto_corrego = any(c == nuc["eixo_leste"] for c in confr) and cfg["rua_leste"] == "Rua do Córrego"
            if perto_corrego and situ == "apto_crf":
                situ = "pendencia"
            ocupante = None
            if not vazio:
                party_seq += 1
                nome = f"{rnd.choice(NOMES)} {rnd.choice(SOBRENOMES)} {rnd.choice(SOBRENOMES)}"
                renda = round(
                    rnd.choice([0.6, 0.9, 1.2, 1.6, 2.1, 2.8, 3.5, 4.2, 6.5]) * SALARIO_MINIMO,
                    2,
                )
                if cfg["modalidade"] == "reurb_e":
                    renda = round(rnd.uniform(6, 14) * SALARIO_MINIMO, 2)
                ocupante = {
                    "nome": nome,
                    "renda_familiar": renda,
                    "renda_sm": round(renda / SALARIO_MINIMO, 1),
                    "composicao_familiar": rnd.randint(1, 6),
                    "tempo_ocupacao_anos": rnd.choice([3, 6, 9, 12, 15, 21, 28]),
                    "uso": rnd.choices(["residencial", "misto", "comercial"], [8, 1.5, 0.5])[0],
                    "pcd": rnd.random() < 0.07,
                    "possui_outro_imovel": rnd.random() < 0.04,
                    "idade": rnd.choice([24, 29, 33, 38, 42, 47, 51, 56, 61, 67, 73]),
                    "escolaridade": rnd.choices(["sem_instrucao", "fundamental", "medio", "superior"], [1, 4, 4, 1.2])[
                        0
                    ],
                    "situacao_profissional": rnd.choices(
                        ["autonomo", "clt", "aposentado", "desempregado", "informal", "servidor"],
                        [3, 3, 2, 1, 2.5, 0.6],
                    )[0],
                    "cpf_mascarado": f"***.{rnd.randint(100, 999)}.{rnd.randint(100, 999)}-**",
                    "documentos": [
                        d
                        for d, p in [
                            ("rg", 0.92),
                            ("cpf", 0.95),
                            ("certidao_casamento", 0.55),
                            ("comprovante_renda", 0.7),
                            ("comprovante_residencia", 0.8),
                            ("declaracao_nao_proprietario", 0.5),
                            ("foto_fachada", 0.85),
                        ]
                        if rnd.random() < p
                    ],
                }
                obrig = ["rg", "cpf"] + (
                    ["comprovante_renda", "declaracao_nao_proprietario"] if cfg["modalidade"] == "reurb_s" else []
                )
                ocupante["documentos_pendentes"] = [d for d in obrig if d not in ocupante["documentos"]]
                if ocupante["possui_outro_imovel"]:
                    situ = "pendencia"
                ocupantes.append((cod, ocupante))
            mem = memorial_descritivo(
                titulo=f"Lote {lt['numero']:02d} — Quadra {lt['quadra']:02d}",
                imovel=f"{cfg['nome']}, Lote {lt['numero']:02d}, Quadra {lt['quadra']:02d}",
                municipio_uf="Viçosa/MG",
                vertices=ordem,
                confrontantes=confr,
                srid_utm=SRID_UTM,
                responsavel=cfg["responsavel"],
                art_rrt=cfg["art"],
            )
            segs = segmentos(ordem, confr)
            poly_utm = lotes_poly[cod][0]
            pendencias = []
            if perto_corrego:
                pendencias.append(
                    "Lote lindeiro ao córrego: verificar faixa de APP no estudo técnico ambiental (art. 35, VIII)."
                )
            if ocupante and ocupante["possui_outro_imovel"]:
                pendencias.append(
                    "Ocupante declarou possuir outro imóvel urbano: vedada legitimação fundiária na REURB-S (art. 23, §1º)."
                )
            if ocupante and ocupante["documentos_pendentes"]:
                faltam = ", ".join(NOME_DOC[d] for d in ocupante["documentos_pendentes"])
                pendencias.append(f"Documentos do ocupante faltando: {faltam}.")
                if situ == "apto_crf":
                    situ = "pendencia"
            if situ == "pendencia" and not pendencias:
                pendencias.append("Documento de identificação do cônjuge pendente.")
            features_lotes.append(
                {
                    "type": "Feature",
                    "geometry": mapping(geo(poly_utm)),
                    "properties": {
                        "codigo": cod,
                        "quadra": lt["quadra"],
                        "numero": lt["numero"],
                        "area_m2": round(area_shoelace(ordem), 2),
                        "perimetro_m": round(sum(s.distancia_m for s in segs), 2),
                        "situacao": situ,
                        "edificado": not vazio,
                        "ocupante": ocupante,
                        "pendencias": pendencias,
                        "vertices": [
                            {
                                "codigo": v.codigo,
                                "e": v.e,
                                "n": v.n,
                                **nuc["pontos_meta"][v.codigo],
                            }
                            for v in ordem
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
                        "memorial": mem,
                    },
                }
            )
            sql.append(
                "insert into ladm.la_spatialunit (projeto_id, nivel, codigo, rotulo, geom, parent_id) values "
                f"({pid}, 'lote', '{cod}', 'Lote {lt['numero']:02d}', ST_GeomFromText('{wkt_geo(poly_utm)}', 4674), "
                f"(select id from ladm.la_spatialunit where projeto_id={pid} and nivel='quadra' and codigo='Q{lt['quadra']:02d}'));"
            )
            for i, v in enumerate(ordem):
                sql.append(
                    "insert into ladm.la_spatialunit_point values ("
                    f"(select id from ladm.la_spatialunit where projeto_id={pid} and codigo='{cod}'), {i + 1}, "
                    f"(select id from ladm.la_point where projeto_id={pid} and codigo='{v.codigo}'));"
                )
            if ocupante:
                sql += [
                    f"insert into ladm.la_party (party_type, nome) values ('pf', {sql_txt(ocupante['nome'])});",
                    f"insert into ladm.la_baunit (nome) values ({sql_txt(cfg['nome'] + ' ' + cod)});",
                    "update ladm.la_spatialunit set baunit_id = currval('ladm.la_baunit_id_seq') "
                    f"where projeto_id={pid} and codigo='{cod}';",
                    "insert into ladm.la_rrr (baunit_id, party_id, tipo, fracao) values "
                    f"(currval('ladm.la_baunit_id_seq'), currval('ladm.la_party_id_seq'), "
                    f"'{'legitimacao_fundiaria' if cfg['modalidade'] == 'reurb_s' else 'posse'}', 1);",
                    "insert into campo.cadastro_social (projeto_id, spatialunit_id, party_id, composicao_familiar, renda_familiar, "
                    "tempo_ocupacao_anos, uso_imovel, possui_outro_imovel, pcd, coletado_em, coletado_por) values "
                    f"({pid}, (select id from ladm.la_spatialunit where projeto_id={pid} and codigo='{cod}'), currval('ladm.la_party_id_seq'), "
                    f"{ocupante['composicao_familiar']}, {ocupante['renda_familiar']}, {ocupante['tempo_ocupacao_anos']}, "
                    f"'{ocupante['uso']}', {sql_txt(ocupante['possui_outro_imovel'])}, {sql_txt(ocupante['pcd'])}, "
                    f"'{(inicio + timedelta(days=85)).isoformat()}', 'Equipe de campo 0{rnd.randint(1, 3)}');",
                ]
            if ocupante:
                for d in ocupante["documentos"]:
                    did = uuid.uuid5(NS, f"{pid}:{cod}:{d}")
                    sql.append(
                        "insert into documentos.documento (id, projeto_id, tipo, titulo, nome_arquivo, mime, tamanho_bytes, sha256, chave_armazenamento, origem) values "
                        f"('{did}', {pid}, '{d}', {sql_txt(NOME_DOC[d] + ' — ' + ocupante['nome'])}, '{d}.{'jpg' if d == 'foto_fachada' else 'pdf'}', "
                        f"'{'image/jpeg' if d == 'foto_fachada' else 'application/pdf'}', {rnd.randint(80_000, 2_400_000)}, "
                        f"'{hashlib.sha256(str(did).encode()).hexdigest()}', '2026/{str(did)[:2]}/{did}', '{'campo' if d == 'foto_fachada' else 'upload'}');"
                    )
                    alvo = (
                        (
                            "spatialunit",
                            f"(select id from ladm.la_spatialunit where projeto_id={pid} and codigo='{cod}')",
                        )
                        if d == "foto_fachada"
                        else ("party", "currval('ladm.la_party_id_seq')")
                    )
                    sql.append(
                        "insert into documentos.vinculo (documento_id, entidade, entidade_id, papel) values "
                        f"('{did}', '{alvo[0]}', ({alvo[1]})::text, '{'foto' if d == 'foto_fachada' else 'comprovante'}');"
                    )
            if perto_corrego and ocupante:
                sql.append(
                    "insert into ladm.la_rrr (baunit_id, tipo, descricao) values (currval('ladm.la_baunit_id_seq'), 'app', "
                    "'Possível incidência de APP (faixa marginal do córrego) — aguardando estudo técnico ambiental');"
                )

        # Notificações (titulares de matrículas atingidas e confrontantes externos) -----
        if FASES.index(cfg["fase_atual"]) >= FASES.index("notificacao"):
            base = date.fromisoformat(fases_json[FASES.index("notificacao")]["iniciada_em"])
            exemplos = [
                (
                    "Espólio de Antônio Pereira Lima",
                    "titular_dominio",
                    "correio_ar",
                    "sem_manifestacao",
                ),
                (
                    "Imobiliária Serra Verde Ltda.",
                    "titular_dominio",
                    "correio_ar",
                    "anuencia",
                ),
                (
                    "Departamento de Estradas (exemplo)",
                    "ente_publico",
                    "eletronico",
                    "anuencia",
                ),
                (
                    "Confrontantes não localizados",
                    "terceiro_interessado",
                    "edital",
                    "sem_manifestacao",
                ),
                ("Carlos Henrique Duarte", "confrontante", "pessoal", "impugnacao"),
            ]
            for i, (nome, papel, meio, resp) in enumerate(exemplos):
                env = base + timedelta(days=2 + i)
                rec = env + timedelta(days=rnd.randint(4, 12))
                notifs.append(
                    {
                        "destinatario": nome,
                        "papel": papel,
                        "meio": meio,
                        "enviada_em": env.isoformat(),
                        "recebida_em": rec.isoformat(),
                        "prazo_fim": (rec + timedelta(days=30)).isoformat(),
                        "resposta": resp,
                        "impugnacao": "Alega sobreposição de 1,8 m na divisa leste da Quadra 03."
                        if resp == "impugnacao"
                        else None,
                    }
                )
                sql.append(
                    "insert into reurb.notificacao (projeto_id, destinatario_nome, papel, meio, enviada_em, recebida_em, resposta, impugnacao_resumo) values "
                    f"({pid}, {sql_txt(nome)}, '{papel}', '{meio}', '{env.isoformat()}', '{rec.isoformat()}', '{resp}', "
                    f"{sql_txt(notifs[-1]['impugnacao'])});"
                )

        # Documentos do processo administrativo ---------------------------------------
        docs_json = []
        modelo_docs = [
            ("requerimento", "requerimento", "Requerimento de instauração da REURB", 2, ["autoridade"]),
            ("requerimento", "despacho", "Despacho de instauração do processo", 1, ["autoridade"]),
            (
                "classificacao",
                "ato_classificacao",
                f"Decreto de classificação — {cfg['modalidade'].replace('_', '-').upper()}",
                3,
                ["autoridade"],
            ),
            ("classificacao", "portaria", "Portaria de designação da comissão técnica", 2, ["autoridade"]),
            ("levantamento", "peca_emitida", "Relatório do levantamento planialtimétrico cadastral", 18, ["rt"]),
            ("notificacao", "oficio", "Ofício de busca cartorária ao Registro de Imóveis", 2, ["autoridade"]),
            ("notificacao", "publicacao_edital", "Comprovante de publicação do edital (Diário Oficial)", 1, []),
            ("notificacao", "ata", "Ata da audiência pública com os moradores", 4, ["autoridade", "rt"]),
            ("projeto", "peca_emitida", "Memorial descritivo do perímetro do núcleo", 3, ["rt"]),
            ("projeto", "peca_emitida", "Planta do perímetro com matrículas atingidas", 1, ["rt"]),
        ]
        ate = FASES.index(cfg["fase_atual"])
        for i, (fase, tipo, titulo, paginas, signatarios) in enumerate(modelo_docs):
            if FASES.index(fase) > ate:
                continue
            did = uuid.uuid5(NS, f"{pid}:proc:{i}")
            data_doc = date.fromisoformat(fases_json[FASES.index(fase)]["iniciada_em"]) + timedelta(days=3 + i)
            cod_ver = hashlib.sha256(str(did).encode()).hexdigest()[:10].upper()
            assinaturas = []
            for papel in signatarios:
                nome_sig = cfg["responsavel"] if papel == "rt" else "Secretaria Municipal de Planejamento (exemplo)"
                concluida = FASES.index(fase) < ate or i % 3 != 2
                assinaturas.append(
                    {
                        "nome": nome_sig,
                        "papel": "Responsável técnico" if papel == "rt" else "Autoridade municipal",
                        "metodo": "icp_brasil" if papel == "rt" else "gov_br_avancada",
                        "situacao": "assinado" if concluida else "pendente",
                        "em": (data_doc + timedelta(days=1)).isoformat() if concluida else None,
                    }
                )
            docs_json.append(
                {
                    "id": str(did),
                    "fase": fase,
                    "tipo": tipo,
                    "titulo": titulo,
                    "data": data_doc.isoformat(),
                    "paginas": paginas,
                    "tamanho_kb": paginas * rnd.randint(120, 420),
                    "codigo_verificacao": cod_ver,
                    "origem": "emitido" if tipo == "peca_emitida" else "upload",
                    "assinaturas": assinaturas,
                }
            )
            sql.append(
                "insert into documentos.documento (id, projeto_id, tipo, titulo, nome_arquivo, mime, tamanho_bytes, sha256, chave_armazenamento, origem, codigo_verificacao, metadados) values "
                f"('{did}', {pid}, '{tipo}', {sql_txt(titulo)}, 'doc-{i + 1:02d}.pdf', 'application/pdf', {docs_json[-1]['tamanho_kb'] * 1024}, "
                f"'{hashlib.sha256(str(did).encode()).hexdigest()}', '2026/{str(did)[:2]}/{did}', '{docs_json[-1]['origem']}', '{cod_ver}', "
                f"'{json.dumps({'paginas': paginas, 'data_documento': data_doc.isoformat()})}'::jsonb);"
            )
            sql.append(
                "insert into documentos.vinculo (documento_id, entidade, entidade_id, papel) values "
                f"('{did}', 'projeto_fase', '{pid}:{fase}', '{'peca_emitida' if tipo == 'peca_emitida' else 'anexo'}');"
            )
            for a_ in assinaturas:
                sql.append(
                    "insert into documentos.assinatura (documento_id, signatario_nome, papel, metodo, situacao, assinado_em, hash_assinado) values "
                    f"('{did}', {sql_txt(a_['nome'])}, {sql_txt(a_['papel'])}, '{a_['metodo']}', '{a_['situacao']}', {sql_txt(a_['em'])}, "
                    f"{sql_txt(hashlib.sha256(str(did).encode()).hexdigest() if a_['situacao'] == 'assinado' else None)});"
                )

        # Peças --------------------------------------------------------------------
        pecas = []
        estado_pecas = {
            "projeto": {
                "levantamento_planialtimetrico": "aprovada",
                "planta_perimetro": "aprovada",
                "memorial_perimetro": "aprovada",
                "estudo_preliminar": "aprovada",
                "memorial_lote": "em_revisao",
                "estudo_ambiental": "em_revisao",
                "estudo_risco": "rascunho",
                "projeto_urbanistico": "rascunho",
                "cadastro_socioeconomico": "aprovada",
                "edital": "assinada",
            },
            "levantamento": {
                "levantamento_planialtimetrico": "rascunho",
                "cadastro_socioeconomico": "rascunho",
            },
        }[cfg["fase_atual"]]
        for tipo, situ in estado_pecas.items():
            pecas.append({"tipo": tipo, "situacao": situ})
            sql.append(
                f"insert into reurb.peca (projeto_id, tipo, situacao, responsavel_tecnico, art_rrt) values "
                f"({pid}, '{tipo}', '{situ}', {sql_txt(cfg['responsavel'])}, {sql_txt(cfg['art'])});"
            )

        perim_v = [
            Vertice(f"{cfg['sigla']}-V-{i + 1:04d}", round(e, 3), round(n, 3))
            for i, (e, n) in enumerate(list(nuc["perimetro"].exterior.coords)[:-1])
        ]
        perim_v = ordenar_horario(perim_v)
        memorial_perimetro = memorial_descritivo(
            titulo=f"Perímetro do {cfg['nome']}",
            imovel=cfg["nome"],
            municipio_uf="Viçosa/MG",
            vertices=perim_v,
            confrontantes=["área remanescente da matrícula (exemplo)"] * len(perim_v),
            srid_utm=SRID_UTM,
            responsavel=cfg["responsavel"],
            art_rrt=cfg["art"],
        )

        saida_json["projetos"].append(
            {
                "id": pid,
                "nome": cfg["nome"],
                "modalidade": cfg["modalidade"],
                "legitimado": cfg["legitimado"],
                "processo_adm": cfg["processo"],
                "municipio": "Viçosa",
                "uf": "MG",
                "municipio_ibge": "3171303",
                "srid_utm": SRID_UTM,
                "responsavel_tecnico": cfg["responsavel"],
                "art_rrt": cfg["art"],
                "fase_atual": cfg["fase_atual"],
                "fases": fases_json,
                "area_nucleo_m2": round(nuc["perimetro"].area, 2),
                "perimetro": {
                    "type": "Feature",
                    "geometry": mapping(geo(nuc["perimetro"])),
                    "properties": {},
                },
                "memorial_perimetro": memorial_perimetro,
                "quadras": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": mapping(geo(q["poly"])),
                            "properties": {"codigo": q["codigo"]},
                        }
                        for q in nuc["quadras"]
                    ],
                },
                "logradouros": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": mapping(geo(ln)),
                            "properties": {"nome": n},
                        }
                        for n, ln in nuc["logradouros"].items()
                    ],
                },
                "lotes": {"type": "FeatureCollection", "features": features_lotes},
                "notificacoes": notifs,
                "pecas": pecas,
                "documentos": docs_json,
            }
        )

    sql += [
        "select setval('reurb.projeto_id_seq', (select max(id) from reurb.projeto));",
        "select setval('campo.levantamento_id_seq', (select max(id) from campo.levantamento));",
        "commit;",
    ]
    (RAIZ / "db/seed").mkdir(parents=True, exist_ok=True)
    (RAIZ / "db/seed/seed.sql").write_text("\n".join(sql) + "\n", encoding="utf-8")
    destino = RAIZ / "apps/web/src/data/seed.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(
        json.dumps(saida_json, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"ok: {sum(len(p['lotes']['features']) for p in saida_json['projetos'])} lotes → db/seed/seed.sql e {destino.relative_to(RAIZ)}"
    )


if __name__ == "__main__":
    gerar()
