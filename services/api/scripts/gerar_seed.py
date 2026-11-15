"""Gera os dados de demonstração e grava db/seed/seed.sql — a ÚNICA saída.

O banco é a fonte dos dados. A interface lê um instantâneo exportado dele
(scripts/exportar_instantaneo.py) ou a API ao vivo; nada é escrito direto para a interface.

Cenário: três núcleos simulados sobre edificações reais do campus da UFV (Viçosa-MG), tiradas do
OpenStreetMap (db/seed/osm/ufv_campus.geojson, ODbL). A geometria é real; pessoas, rendas, documentos,
processos e situações são INVENTADOS. Nenhum desses prédios está em regularização fundiária.

    uv run python scripts/gerar_seed.py
"""

from __future__ import annotations

import hashlib
import json
import random
import uuid
from datetime import date, timedelta
from pathlib import Path

import shapely
from pyproj import Transformer
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon, shape
from shapely.geometry.polygon import orient
from shapely.ops import linemerge, unary_union

RAIZ = Path(__file__).resolve().parents[3]
OSM = RAIZ / "db/seed/osm/ufv_campus.geojson"
SRID_UTM = 31983  # SIRGAS 2000 / UTM 23S
_para_utm = Transformer.from_crs(4674, SRID_UTM, always_xy=True).transform
_para_geo = Transformer.from_crs(SRID_UTM, 4674, always_xy=True).transform
FAIXA_APP_M = 30.0
FAIXA_NAO_EDIFICAVEL_M = 15.0  # Lei 12.651/2012, art. 65, §2º

NOMES = [
    "Maria", "José", "Ana", "João", "Antônia", "Francisco", "Luzia", "Sebastião", "Aparecida", "Geraldo",
    "Rita", "Raimundo", "Conceição", "Pedro", "Helena", "Joaquim", "Fátima", "Paulo", "Lúcia", "Benedito",
    "Rosa", "Marcos", "Sandra", "Luiz", "Cláudia", "Wellington", "Jéssica", "Adriano", "Simone", "Edson",
]  # fmt: skip
SOBRENOMES = [
    "Silva", "Santos", "Oliveira", "Souza", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Lima",
    "Araújo", "Fernandes", "Carvalho", "Gomes", "Martins", "Rocha", "Ribeiro", "Alves", "Barbosa", "Teixeira",
]  # fmt: skip
SALARIO_MINIMO = 1518.00
NS = uuid.UUID("6f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d")  # namespace fixo: ids determinísticos
NOME_DOC = {
    "rg": "Documento de identidade",
    "cpf": "CPF",
    "certidao_casamento": "Certidão de casamento / união estável",
    "comprovante_renda": "Comprovante de renda",
    "comprovante_residencia": "Comprovante de residência",
    "declaracao_nao_proprietario": "Declaração de não possuir outro imóvel",
    "foto_fachada": "Foto da fachada",
}
FASES = [
    "diagnostico", "requerimento", "classificacao", "levantamento", "notificacao",
    "projeto", "saneamento", "aprovacao", "crf", "registro",
]  # fmt: skip
DURACOES = {
    "diagnostico": 21, "requerimento": 10, "classificacao": 35, "levantamento": 60, "notificacao": 45,
    "projeto": 75, "saneamento": 30, "aprovacao": 20, "crf": 15, "registro": 30,
}  # fmt: skip
PRAZOS_LEGAIS = {"classificacao": 180, "notificacao": 30}

# Caixas em UTM 23S (E mín, E máx, N mín, N máx) sobre o campus da UFV.
PROJETOS = [
    {
        "id": 1,
        "nome": "Núcleo Vila Esperança",
        "sigla": "VES",
        "modalidade": "reurb_s",
        "legitimado": "Município de Viçosa",
        "processo": "2026.0142-REURB-S",
        "caixa": (721650, 722130, 7702380, 7702790),
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
        "caixa": (722090, 722540, 7702570, 7702960),
        "fase_atual": "levantamento",
        "responsavel": "Eng. Cartógrafo (exemplo) — CREA-MG 000001/D",
        "art": "MG20260000001",
        "inicio": "2026-07-20",
        "seed": 11,
    },
    {
        "id": 3,
        "nome": "Núcleo Alto da Boa Vista",
        "sigla": "ABV",
        "modalidade": "reurb_s",
        "legitimado": "Defensoria Pública do Estado de Minas Gerais",
        "processo": "2026.0233-REURB-S",
        "caixa": (721740, 722010, 7702860, 7703140),
        "fase_atual": "notificacao",
        "responsavel": "Eng. Agrimensor e Cartógrafo (exemplo) — CREA-MG 000002/D",
        "art": "MG20260000002",
        "inicio": "2026-06-22",
        "seed": 23,
    },
]

PECAS_POR_FASE = {
    "levantamento": {"levantamento_planialtimetrico": "rascunho", "cadastro_socioeconomico": "rascunho"},
    "notificacao": {
        "levantamento_planialtimetrico": "aprovada",
        "cadastro_socioeconomico": "aprovada",
        "planta_perimetro": "em_revisao",
        "edital": "assinada",
        "estudo_preliminar": "rascunho",
    },
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
}

# Achados da inteligência territorial que só ilustram o formato (origem = 'simulado').
# O de hidrografia é calculado de verdade, mais abaixo, sobre a geometria do OpenStreetMap.
ACHADOS_SIMULADOS = {
    1: {
        "resumo": "Ocupação consolidada antes do marco temporal, em área urbana. A proximidade do lago exige "
        "estudo técnico ambiental; duas matrículas-mãe atingidas; infraestrutura parcial.",
        "achados": [
            ("marco_temporal", "ok", "Ocupação visível em imagem de 06/2014 em todas as unidades atuais.", "Atende ao marco temporal."),
            ("risco", "atencao", "Fora de setor de risco mapeado; alagamento pontual relatado em 2022.", "Registrar no estudo preliminar; verificar drenagem no projeto urbanístico."),
            ("declividade", "ok", "Declividade média de 7%, máxima de 19%.", "Abaixo de 30%; sem exigência especial."),
            ("setor_censitario", "ok", "Renda domiciliar mediana do setor de 1,9 SM; 212 domicílios.", "Coerente com a classificação REURB-S."),
            ("zoneamento", "ok", "ZEIS-2 (lei municipal de uso do solo).", "Zona compatível; parâmetros urbanísticos especiais aplicáveis."),
            ("matriculas", "condiciona", "2 matrículas atingidas (uma com espólio; uma pessoa jurídica).", "Notificar titulares (art. 31); espólio exige inventariante ou edital."),
            ("car", "ok", "Sem CAR sobreposto.", None),
            ("sigef", "ok", "Sem parcela SIGEF sobreposta.", None),
            ("uc_ti", "ok", "Fora de UC, zona de amortecimento e TI.", None),
            ("infraestrutura", "condiciona", "Água e energia em 100% das unidades; esgoto em 61%; sem drenagem.", "Cronograma de obras e termo de compromisso (art. 35, IX-X)."),
            ("patrimonio", "ok", "Sem bem tombado ou sítio cadastrado num raio de 500 m.", None),
        ],
    },
    2: {
        "resumo": "Ocupação de renda média com infraestrutura quase completa. Parte do perímetro em área que o "
        "cadastro ainda trata como rural: precisa de desafetação e checagem no SIGEF antes do registro.",
        "achados": [
            ("marco_temporal", "ok", "Ocupação em todas as unidades em imagem de 09/2016.", "Atende ao marco temporal."),
            ("risco", "ok", "Sem setor de risco.", None),
            ("declividade", "atencao", "Declividade média de 12%, máxima de 27%.", "Verificar contenções nas unidades de maior declive."),
            ("setor_censitario", "ok", "Renda mediana do setor de 7,4 SM.", "Coerente com REURB-E."),
            ("zoneamento", "condiciona", "Zona de expansão urbana; 30% do perímetro fora do perímetro urbano legal.", "Lei municipal de inclusão no perímetro urbano antes da aprovação."),
            ("matriculas", "ok", "1 matrícula-mãe (loteador identificado).", "Notificação simples."),
            ("car", "condiciona", "CAR ativo sobre a gleba de origem (imóvel rural).", "Retificar ou cancelar o CAR da parte urbanizada."),
            ("sigef", "impede", "Parcela SIGEF certificada sobreposta em 1,2 ha.", "Registro barrado até desmembramento e atualização no INCRA (art. 44)."),
            ("uc_ti", "ok", "Fora de UC e TI.", None),
            ("infraestrutura", "atencao", "Água, energia e drenagem completas; esgoto por fossa.", "Solução de esgotamento no projeto urbanístico."),
            ("patrimonio", "sem_dado", "Sem dado disponível para a área.", "Consultar o IPHAN antes da aprovação."),
        ],
    },
    3: {
        "resumo": "Ocupação de baixa renda em encosta suave, com buscas cartoriais em andamento. Um confrontante "
        "impugnou a divisa; o restante das notificações corre no prazo.",
        "achados": [
            ("marco_temporal", "ok", "Ocupação visível em imagem de 11/2015 em 11 das 12 unidades.", "Uma unidade posterior ao marco: tratar à parte (art. 9º, §2º)."),
            ("risco", "condiciona", "Setor de risco R2 (médio) a montante, a 40 m do perímetro.", "Estudo técnico de risco antes da aprovação (art. 39)."),
            ("declividade", "atencao", "Declividade média de 16%, máxima de 31% em faixa estreita.", "Trecho acima de 30% depende de laudo (Lei 6.766/1979, art. 3º, III)."),
            ("setor_censitario", "ok", "Renda domiciliar mediana do setor de 1,4 SM.", "Coerente com a classificação REURB-S."),
            ("zoneamento", "ok", "Zona residencial 2, dentro do perímetro urbano.", None),
            ("matriculas", "condiciona", "3 matrículas atingidas; uma sem titular localizado.", "Notificação por edital para o titular não localizado (art. 31, §5º)."),
            ("car", "ok", "Sem CAR sobreposto.", None),
            ("sigef", "ok", "Sem parcela SIGEF sobreposta.", None),
            ("uc_ti", "ok", "Fora de UC e TI.", None),
            ("infraestrutura", "condiciona", "Energia em 100%; água em 83%; esgoto em 40%.", "Cronograma de obras e termo de compromisso (art. 35, IX-X)."),
            ("patrimonio", "ok", "Sem bem tombado ou sítio cadastrado num raio de 500 m.", None),
        ],
    },
}
PESO = {"impede": 35, "condiciona": 15, "atencao": 6, "ok": 0, "sem_dado": 3}


def utm(geom):
    return shapely.transform(geom, lambda xy: __import__("numpy").column_stack(_para_utm(xy[:, 0], xy[:, 1])))


def geo(geom):
    return shapely.transform(geom, lambda xy: __import__("numpy").column_stack(_para_geo(xy[:, 0], xy[:, 1])))


def wkt_multi(geom) -> str:
    g = geo(geom)
    return (MultiPolygon([g]) if isinstance(g, Polygon) else g).wkt


def q(v) -> str:
    """Literal SQL."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def carregar_osm() -> dict:
    bruto = json.loads(OSM.read_text(encoding="utf-8"))
    saida = {"edificacao": [], "logradouro": [], "agua": []}
    for f in bruto["features"]:
        saida[f["properties"]["classe"]].append((f["properties"], utm(shape(f["geometry"]))))
    return saida


def nucleo(cfg: dict, osm: dict) -> dict:
    """Unidades = edificações do OSM dentro da caixa; quadras = grupos de edificações próximas."""
    e0, e1, n0, n1 = cfg["caixa"]
    plantas: list[Polygon] = []
    for _, g in osm["edificacao"]:
        c = g.centroid
        if not (e0 <= c.x <= e1 and n0 <= c.y <= n1 and 60 < g.area < 6500):
            continue
        s = orient(g.simplify(0.4), sign=-1.0)  # sentido horário
        if s.is_valid and 4 <= len(s.exterior.coords) - 1 <= 16:
            plantas.append(s)

    manchas = unary_union([p.buffer(22) for p in plantas])
    manchas = sorted(getattr(manchas, "geoms", [manchas]), key=lambda m: (-round(m.centroid.y / 120), m.centroid.x))
    quadras, lotes = [], []
    pontos: dict[tuple, dict] = {}
    for qi, mancha in enumerate(manchas, start=1):
        membros = sorted(
            (p for p in plantas if mancha.contains(p.centroid)),
            key=lambda p: (-round(p.centroid.y / 35), p.centroid.x),
        )
        casco = unary_union(membros).convex_hull
        quadras.append({"codigo": f"Q{qi:02d}", "poly": orient(casco.buffer(6, join_style=2), sign=-1.0)})
        for num, planta in enumerate(membros, start=1):
            anel = list(planta.exterior.coords)[:-1]
            i0 = max(range(len(anel)), key=lambda i: (anel[i][1], -anel[i][0]))  # começa no vértice mais ao norte
            anel = anel[i0:] + anel[:i0]
            vs = []
            for e, n in anel:
                chave = (round(e, 2), round(n, 2))  # parede comum = mesmos vértices
                if chave not in pontos:
                    marco = casco.exterior.distance(Point(e, n)) < 0.05
                    pontos[chave] = {"e": round(e, 3), "n": round(n, 3), "tipo": "M" if marco else "P", "seq": len(pontos) + 1}
                vs.append(pontos[chave])
            lotes.append({"codigo": f"Q{qi:02d}-L{num:02d}", "quadra": qi, "numero": num, "vertices": vs,
                          "poly": Polygon([(v["e"], v["n"]) for v in vs])})  # fmt: skip

    perimetro = orient(unary_union([qd["poly"] for qd in quadras]).convex_hull.buffer(10, join_style=2).simplify(0.01), sign=-1.0)
    entorno = perimetro.buffer(60)
    ruas: dict[str, list] = {}
    for props, g in osm["logradouro"]:
        if props["nome"] and g.intersects(entorno):
            ruas.setdefault(props["nome"], []).append(g.intersection(entorno))
    logradouros = []
    for nome, partes in sorted(ruas.items()):
        unido = unary_union(partes)
        if isinstance(unido, MultiLineString):
            unido = linemerge(unido)
        for linha in getattr(unido, "geoms", [unido]):
            if isinstance(linha, LineString) and linha.length > 8:
                logradouros.append((nome, linha.simplify(0.3)))
    # Corpos d'água próximos, inteiros (cortar o polígono criaria margens retas que não existem).
    # Trechos curtos e sem nome são valas e drenos mapeados no OSM: não entram.
    aguas = [
        (props["nome"] or ("Lago" if g.geom_type == "Polygon" else "Curso d'água"), g)
        for props, g in osm["agua"]
        if g.distance(perimetro) < 150 and (g.geom_type == "Polygon" and g.area > 400 or g.geom_type != "Polygon" and (props["nome"] or g.length > 120))
    ]
    return {"lotes": lotes, "quadras": quadras, "perimetro": perimetro, "logradouros": logradouros,
            "aguas": aguas, "pontos": pontos}  # fmt: skip


def gerar() -> None:
    osm = carregar_osm()
    sql: list[str] = [
        "-- Gerado por services/api/scripts/gerar_seed.py — DADOS FICTÍCIOS sobre geometria do OpenStreetMap (ODbL).",
        "-- Substitui o conteúdo de demonstração. NÃO aplicar em base com dados reais.",
        "begin;",
        "truncate reurb.projeto, ladm.la_party, ladm.la_baunit, inteligencia.dossie, metadados.conjunto_dados, "
        "auditoria.evento restart identity cascade;",
    ]
    total = 0
    for cfg in PROJETOS:
        rnd = random.Random(cfg["seed"])
        nuc = nucleo(cfg, osm)
        pid, sigla = cfg["id"], cfg["sigla"]
        su = lambda cod, nivel="lote", pid=pid: (  # noqa: E731
            f"(select id from ladm.la_spatialunit where projeto_id={pid} and nivel='{nivel}' and codigo='{cod}')"
        )
        sql.append(
            "insert into reurb.projeto (id, nome, processo_adm, modalidade, legitimado, municipio_ibge, municipio_nome, uf, "
            "srid_utm, responsavel_tecnico, art_rrt, ocupacao_ate_marco_temporal) overriding system value values "
            f"({pid}, {q(cfg['nome'])}, {q(cfg['processo'])}, {q(cfg['modalidade'])}, {q(cfg['legitimado'])}, "
            f"'3171303', 'Viçosa', 'MG', {SRID_UTM}, {q(cfg['responsavel'])}, {q(cfg['art'])}, true);"
        )

        # Fases ---------------------------------------------------------------------------------
        inicio = date.fromisoformat(cfg["inicio"])
        ate = FASES.index(cfg["fase_atual"])
        inicio_fase: dict[str, date] = {}
        cursor = inicio
        for i, f in enumerate(FASES):
            situ = "concluida" if i < ate else ("em_andamento" if i == ate else "pendente")
            ini = cursor if i <= ate else None
            fim = cursor + timedelta(days=DURACOES[f]) if i < ate else None
            prazo = ini + timedelta(days=PRAZOS_LEGAIS[f]) if (ini and f in PRAZOS_LEGAIS) else None
            if ini:
                inicio_fase[f] = ini
            if fim:
                cursor = fim
            sql.append(
                "insert into reurb.projeto_fase (projeto_id, fase_codigo, situacao, iniciada_em, prazo_em, concluida_em) values "
                f"({pid}, '{f}', '{situ}', {q(ini and ini.isoformat())}, {q(prazo and prazo.isoformat())}, {q(fim and fim.isoformat())});"
            )

        # Levantamento ---------------------------------------------------------------------------
        sql.append(
            "insert into campo.levantamento (id, projeto_id, tipo, equipamento, data_inicio, data_fim, responsavel, art_rrt, norma) "
            f"overriding system value values ({pid}, {pid}, 'topografico', 'Receptor GNSS RTK L1/L2 + estação total 2\"', "
            f"'{(inicio + timedelta(days=66)).isoformat()}', '{(inicio + timedelta(days=100)).isoformat()}', "
            f"{q(cfg['responsavel'])}, {q(cfg['art'])}, 'ABNT NBR 13133:2021; ABNT NBR 17047:2022');"
        )

        # Núcleo, quadras, logradouros, hidrografia -------------------------------------------------
        sql.append(
            "insert into ladm.la_spatialunit (projeto_id, nivel, codigo, rotulo, geom) values "
            f"({pid}, 'nucleo', 'NUCLEO', {q(cfg['nome'])}, ST_GeomFromText('{wkt_multi(nuc['perimetro'])}', 4674));"
        )
        for qd in nuc["quadras"]:
            sql.append(
                "insert into ladm.la_spatialunit (projeto_id, nivel, codigo, rotulo, geom, parent_id) values "
                f"({pid}, 'quadra', '{qd['codigo']}', 'Quadra {qd['codigo'][1:]}', ST_GeomFromText('{wkt_multi(qd['poly'])}', 4674), "
                f"{su('NUCLEO', 'nucleo')});"
            )
        for nome, linha in nuc["logradouros"]:
            sql.append(
                f"insert into reurb.logradouro (projeto_id, nome, geom) values ({pid}, {q(nome)}, ST_GeomFromText('{geo(linha).wkt}', 4674));"
            )
        for nome, g in nuc["aguas"]:
            sql.append(
                f"insert into reurb.hidrografia (projeto_id, nome, fonte, geom) values ({pid}, {q(nome)}, 'OpenStreetMap', "
                f"ST_GeomFromText('{geo(g).wkt}', 4674));"
            )

        # Vértices ----------------------------------------------------------------------------------
        for p in sorted(nuc["pontos"].values(), key=lambda p: p["seq"]):
            p["codigo"] = f"{sigla}-{p['tipo']}-{p['seq']:04d}"
            gnss = p["tipo"] == "M"
            sigma = round(rnd.uniform(0.012, 0.035), 3) if gnss else round(rnd.uniform(0.015, 0.042), 3)
            lon, lat = _para_geo(p["e"], p["n"])
            sql.append(
                "insert into ladm.la_point (projeto_id, codigo, tipo, metodo, geom, sigma_e, sigma_n, sigma_h, levantamento_id, medido_em) values "
                f"({pid}, '{p['codigo']}', '{p['tipo']}', '{'gnss_rtk' if gnss else 'estacao_total'}', "
                f"ST_SetSRID(ST_MakePoint({lon:.9f}, {lat:.9f}, {round(650 + rnd.uniform(-4, 4), 3)}), 4674), "
                f"{sigma}, {sigma}, {round(sigma * 1.6, 3)}, {pid}, '{(inicio + timedelta(days=80)).isoformat()}');"
            )

        # Unidades, ocupantes, cadastro social -----------------------------------------------------------
        situacoes = {
            "projeto": ["apto_crf"] * 6 + ["notificado", "notificado", "cadastrado", "pendencia"],
            "notificacao": ["notificado", "notificado", "notificado", "cadastrado", "pendencia"],
            "levantamento": ["levantado", "levantado", "cadastrado", "pendencia"],
        }[cfg["fase_atual"]]
        em_app = 0
        reforco = 0.3 if cfg["fase_atual"] == "projeto" else 0.0  # processo adiantado: documentação quase completa
        dist_agua = min((g.distance(nuc["perimetro"]) for _, g in nuc["aguas"]), default=None)
        for lt in nuc["lotes"]:
            cod = lt["codigo"]
            total += 1
            sql.append(
                "insert into ladm.la_spatialunit (projeto_id, nivel, codigo, rotulo, geom, parent_id) values "
                f"({pid}, 'lote', '{cod}', 'Lote {lt['numero']:02d}', ST_GeomFromText('{wkt_multi(lt['poly'])}', 4674), "
                f"{su(f'Q{lt["quadra"]:02d}', 'quadra')});"
            )
            for i, v in enumerate(lt["vertices"], start=1):
                sql.append(
                    f"insert into ladm.la_spatialunit_point values ({su(cod)}, {i}, "
                    f"(select id from ladm.la_point where projeto_id={pid} and codigo='{v['codigo']}'));"
                )

            vazio = rnd.random() < 0.08
            situ = "levantado" if vazio else rnd.choice(situacoes)
            dist_lote = min((g.distance(lt["poly"]) for _, g in nuc["aguas"]), default=9e9)
            em_app += dist_lote < FAIXA_APP_M  # entra na contagem do dossiê
            perto_agua = dist_lote < FAIXA_NAO_EDIFICAVEL_M  # vira pendência da unidade
            pendencias: list[tuple[str, str, str | None, bool]] = []  # origem, descrição, base legal, é da pessoa
            if perto_agua:
                pendencias.append((
                    "ambiental",
                    f"Unidade a menos de {FAIXA_NAO_EDIFICAVEL_M:.0f} m de corpo d'água: verificar faixa não edificável no estudo técnico ambiental.",
                    "Lei 13.465/2017, art. 35, VIII; Lei 12.651/2012, arts. 64-65",
                    False,
                ))  # fmt: skip
                if situ == "apto_crf":
                    situ = "pendencia"
            if not vazio:
                nome = f"{rnd.choice(NOMES)} {rnd.choice(SOBRENOMES)} {rnd.choice(SOBRENOMES)}"
                renda = round(rnd.choice([0.6, 0.9, 1.2, 1.6, 2.1, 2.8, 3.5, 4.2, 6.5]) * SALARIO_MINIMO, 2)
                if cfg["modalidade"] == "reurb_e":
                    renda = round(rnd.uniform(6, 14) * SALARIO_MINIMO, 2)
                idade = rnd.choice([24, 29, 33, 38, 42, 47, 51, 56, 61, 67, 73])
                nascimento = date(2026 - idade, rnd.randint(1, 6), rnd.randint(1, 28))
                outro_imovel = rnd.random() < 0.04
                escolaridade = rnd.choices(["sem_instrucao", "fundamental", "medio", "superior"], [1, 4, 4, 1.2])[0]
                profissao = rnd.choices(
                    ["autonomo", "clt", "aposentado", "desempregado", "informal", "servidor"], [3, 3, 2, 1, 2.5, 0.6]
                )[0]
                docs = [
                    d
                    for d, prob in [("rg", 0.92), ("cpf", 0.95), ("certidao_casamento", 0.55), ("comprovante_renda", 0.7),
                                    ("comprovante_residencia", 0.8), ("declaracao_nao_proprietario", 0.5), ("foto_fachada", 0.85)]
                    if rnd.random() < min(0.98, prob + reforco)
                ]  # fmt: skip
                obrig = ["rg", "cpf"] + (["comprovante_renda", "declaracao_nao_proprietario"] if cfg["modalidade"] == "reurb_s" else [])
                faltam = [d for d in obrig if d not in docs]
                if outro_imovel:
                    pendencias.append((
                        "juridica",
                        "Ocupante declarou possuir outro imóvel urbano: vedada a legitimação fundiária na REURB-S.",
                        "Lei 13.465/2017, art. 23, §1º, I",
                        True,
                    ))  # fmt: skip
                    situ = "pendencia"
                if faltam:
                    pendencias.append((
                        "documental",
                        "Documentos do ocupante faltando: " + ", ".join(NOME_DOC[d] for d in faltam) + ".",
                        "Dec. 9.310/2018, art. 38",
                        True,
                    ))  # fmt: skip
                    if situ == "apto_crf":
                        situ = "pendencia"
                # CPF fictício: prefixo 000 e dígitos verificadores 00 para não coincidir de propósito com um real
                cpf = f"000{rnd.randint(0, 999_999):06d}00"
                sql += [
                    f"insert into ladm.la_party (party_type, nome, cpf_cnpj, data_nascimento) values ('pf', {q(nome)}, '{cpf}', '{nascimento.isoformat()}');",
                    f"insert into ladm.la_baunit (nome, uso) values ({q(cfg['nome'] + ' ' + cod)}, 'urbano');",
                    f"update ladm.la_spatialunit set baunit_id = currval('ladm.la_baunit_id_seq') where projeto_id={pid} and codigo='{cod}';",
                    "insert into ladm.la_rrr (baunit_id, party_id, tipo, fracao) values "
                    f"(currval('ladm.la_baunit_id_seq'), currval('ladm.la_party_id_seq'), "
                    f"'{'legitimacao_fundiaria' if cfg['modalidade'] == 'reurb_s' else 'posse'}', 1);",
                    "insert into campo.cadastro_social (projeto_id, spatialunit_id, party_id, composicao_familiar, renda_familiar, "
                    "tempo_ocupacao_anos, uso_imovel, possui_outro_imovel, pcd, escolaridade, situacao_profissional, coletado_em, coletado_por) values "
                    f"({pid}, {su(cod)}, currval('ladm.la_party_id_seq'), {rnd.randint(1, 6)}, {renda}, "
                    f"{rnd.choice([3, 6, 9, 12, 15, 21, 28])}, '{rnd.choices(['residencial', 'misto', 'comercial'], [8, 1.5, 0.5])[0]}', "
                    f"{q(outro_imovel)}, {q(rnd.random() < 0.07)}, '{escolaridade}', '{profissao}', "
                    f"'{(inicio + timedelta(days=85)).isoformat()}', 'Equipe de campo 0{rnd.randint(1, 3)}');",
                ]
                for d in docs:
                    did = uuid.uuid5(NS, f"{pid}:{cod}:{d}")
                    foto = d == "foto_fachada"
                    sql.append(
                        "insert into documentos.documento (id, projeto_id, tipo, titulo, nome_arquivo, mime, tamanho_bytes, sha256, chave_armazenamento, origem) values "
                        f"('{did}', {pid}, '{d}', {q(NOME_DOC[d] + ' — ' + nome)}, '{d}.{'jpg' if foto else 'pdf'}', "
                        f"'{'image/jpeg' if foto else 'application/pdf'}', {rnd.randint(80_000, 2_400_000)}, "
                        f"'{hashlib.sha256(str(did).encode()).hexdigest()}', '2026/{str(did)[:2]}/{did}', '{'campo' if foto else 'upload'}');"
                    )
                    alvo = ("spatialunit", su(cod)) if foto else ("party", "currval('ladm.la_party_id_seq')")
                    sql.append(
                        "insert into documentos.vinculo (documento_id, entidade, entidade_id, papel) values "
                        f"('{did}', '{alvo[0]}', ({alvo[1]})::text, '{'foto' if foto else 'comprovante'}');"
                    )
                if perto_agua:
                    sql.append(
                        "insert into ladm.la_rrr (baunit_id, tipo, descricao) values (currval('ladm.la_baunit_id_seq'), 'app', "
                        "'Possível incidência de APP (margem de corpo d''água) — aguardando estudo técnico ambiental');"
                    )
            if situ == "pendencia" and not pendencias:
                pendencias.append(("documental", "Documento de identificação do cônjuge pendente.", "Dec. 9.310/2018, art. 38", True))
            sql.append(f"insert into reurb.unidade_situacao (spatialunit_id, situacao) values ({su(cod)}, '{situ}');")
            for origem, texto, base, da_pessoa in pendencias:
                sql.append(
                    "insert into reurb.pendencia (projeto_id, spatialunit_id, party_id, origem, descricao, base_legal, aberta_em) values "
                    f"({pid}, {su(cod)}, {'currval(' + q('ladm.la_party_id_seq') + ')' if da_pessoa and not vazio else 'null'}, "
                    f"'{origem}', {q(texto)}, {q(base)}, '{(inicio + timedelta(days=90)).isoformat()}');"
                )

        # Notificações (titulares de matrículas atingidas e confrontantes externos) -----------------------
        if ate >= FASES.index("notificacao"):
            base = inicio_fase["notificacao"]
            em_curso = cfg["fase_atual"] == "notificacao"
            exemplos = [
                ("Espólio de Antônio Pereira Lima", "titular_dominio", "correio_ar", "sem_manifestacao"),
                ("Imobiliária Serra Verde Ltda.", "titular_dominio", "correio_ar", "anuencia"),
                ("Departamento de Estradas (exemplo)", "ente_publico", "eletronico", "anuencia"),
                ("Confrontantes não localizados", "terceiro_interessado", "edital", "sem_manifestacao"),
                ("Carlos Henrique Duarte", "confrontante", "pessoal", "impugnacao"),
            ]
            for i, (nome, papel, meio, resp) in enumerate(exemplos):
                env = base + timedelta(days=2 + i)
                rec = env + timedelta(days=rnd.randint(4, 12))
                if em_curso and resp == "sem_manifestacao":
                    resp_sql = "null"  # prazo ainda correndo: não há resposta a registrar
                else:
                    resp_sql = f"'{resp}'"
                texto = f"Alega sobreposição de 1,8 m na divisa leste da Quadra {len(nuc['quadras']):02d}." if resp == "impugnacao" else None
                sql.append(
                    "insert into reurb.notificacao (projeto_id, destinatario_nome, papel, meio, enviada_em, recebida_em, resposta, impugnacao_resumo) values "
                    f"({pid}, {q(nome)}, '{papel}', '{meio}', '{env.isoformat()}', '{rec.isoformat()}', {resp_sql}, {q(texto)});"
                )

        # Documentos do processo administrativo -------------------------------------------------------
        modelo_docs = [
            ("requerimento", "requerimento", "Requerimento de instauração da REURB", 2, ["autoridade"]),
            ("requerimento", "despacho", "Despacho de instauração do processo", 1, ["autoridade"]),
            ("classificacao", "ato_classificacao", f"Decreto de classificação — {cfg['modalidade'].replace('_', '-').upper()}", 3, ["autoridade"]),
            ("classificacao", "portaria", "Portaria de designação da comissão técnica", 2, ["autoridade"]),
            ("levantamento", "peca_emitida", "Relatório do levantamento planialtimétrico cadastral", 18, ["rt"]),
            ("notificacao", "oficio", "Ofício de busca cartorária ao Registro de Imóveis", 2, ["autoridade"]),
            ("notificacao", "publicacao_edital", "Comprovante de publicação do edital (Diário Oficial)", 1, []),
            ("notificacao", "ata", "Ata da audiência pública com os moradores", 4, ["autoridade", "rt"]),
            ("projeto", "peca_emitida", "Memorial descritivo do perímetro do núcleo", 3, ["rt"]),
            ("projeto", "peca_emitida", "Planta do perímetro com matrículas atingidas", 1, ["rt"]),
        ]
        for i, (fase, tipo, titulo, paginas, signatarios) in enumerate(modelo_docs):
            if FASES.index(fase) > ate:
                continue
            did = uuid.uuid5(NS, f"{pid}:proc:{i}")
            data_doc = inicio_fase[fase] + timedelta(days=3 + i)
            cod_ver = hashlib.sha256(str(did).encode()).hexdigest()[:10].upper()
            emitido = tipo == "peca_emitida"
            sql.append(
                "insert into documentos.documento (id, projeto_id, tipo, titulo, nome_arquivo, mime, tamanho_bytes, sha256, chave_armazenamento, origem, codigo_verificacao, metadados) values "
                f"('{did}', {pid}, '{tipo}', {q(titulo)}, 'doc-{i + 1:02d}.pdf', 'application/pdf', {paginas * rnd.randint(120, 420) * 1024}, "
                f"'{hashlib.sha256(str(did).encode()).hexdigest()}', '2026/{str(did)[:2]}/{did}', '{'emitido' if emitido else 'upload'}', '{cod_ver}', "
                f"'{json.dumps({'paginas': paginas, 'data_documento': data_doc.isoformat()})}'::jsonb);"
            )
            sql.append(
                "insert into documentos.vinculo (documento_id, entidade, entidade_id, papel) values "
                f"('{did}', 'projeto_fase', '{pid}:{fase}', '{'peca_emitida' if emitido else 'anexo'}');"
            )
            for papel in signatarios:
                rt = papel == "rt"
                assinado = FASES.index(fase) < ate or i % 3 != 2
                sql.append(
                    "insert into documentos.assinatura (documento_id, signatario_nome, papel, metodo, situacao, assinado_em, hash_assinado) values "
                    f"('{did}', {q(cfg['responsavel'] if rt else 'Secretaria Municipal de Planejamento (exemplo)')}, "
                    f"'{'Responsável técnico' if rt else 'Autoridade municipal'}', '{'icp_brasil' if rt else 'gov_br_avancada'}', "
                    f"'{'assinado' if assinado else 'pendente'}', {q((data_doc + timedelta(days=1)).isoformat() if assinado else None)}, "
                    f"{q(hashlib.sha256(str(did).encode()).hexdigest() if assinado else None)});"
                )

        # Peças ---------------------------------------------------------------------------------------
        for tipo, situ in PECAS_POR_FASE[cfg["fase_atual"]].items():
            sql.append(
                "insert into reurb.peca (projeto_id, tipo, situacao, responsavel_tecnico, art_rrt) values "
                f"({pid}, '{tipo}', '{situ}', {q(cfg['responsavel'])}, {q(cfg['art'])});"
            )

        # Inteligência territorial ------------------------------------------------------------------------
        modelo = ACHADOS_SIMULADOS[pid]
        if dist_agua is None:
            hidro = ("ok", "Nenhum corpo d'água a menos de 150 m do perímetro (base OpenStreetMap).", None, {"distancia_min_m": None})
        elif em_app:
            hidro = (
                "condiciona",
                f"{em_app} de {len(nuc['lotes'])} unidades a menos de {FAIXA_APP_M:.0f} m de corpo d'água; "
                + ("o perímetro toca a margem." if dist_agua < 1 else f"o perímetro fica a {dist_agua:.0f} m da margem mais próxima."),
                "Faixa não edificável de 15 m (REURB-E) ou estudo técnico com melhoria ambiental (REURB-S, art. 64).",
                {"distancia_min_m": round(dist_agua, 1), "unidades_na_faixa": em_app, "faixa_m": FAIXA_APP_M},
            )
        else:
            hidro = (
                "atencao",
                f"Corpo d'água a {dist_agua:.0f} m do perímetro; nenhuma unidade na faixa de {FAIXA_APP_M:.0f} m.",
                "Registrar no estudo técnico ambiental; sem restrição direta às unidades.",
                {"distancia_min_m": round(dist_agua, 1), "unidades_na_faixa": 0, "faixa_m": FAIXA_APP_M},
            )
        achados = [("hidrografia_app", *hidro, "calculado")] + [(c, s, r, i, {}, "simulado") for c, s, r, i in modelo["achados"]]
        pontuacao = max(0, 100 - sum(PESO[a[1]] for a in achados))
        sql.append(
            "insert into inteligencia.dossie (projeto_id, nome, geom, srid_utm, resumo, pontuacao) values "
            f"({pid}, {q('Dossiê do ' + cfg['nome'])}, ST_GeomFromText('{wkt_multi(nuc['perimetro'])}', 4674), {SRID_UTM}, "
            f"{q(modelo['resumo'])}, {pontuacao});"
        )
        for camada, sev, resultado, implicacao, metricas, origem in achados:
            sql.append(
                "insert into inteligencia.achado (dossie_id, camada_codigo, camada_nome, severidade, resultado, implicacao, base_legal, metricas, origem) "
                f"select currval('inteligencia.dossie_id_seq'), c.codigo, c.nome, '{sev}', {q(resultado)}, {q(implicacao)}, c.base_legal, "
                f"'{json.dumps(metricas)}'::jsonb, '{origem}' from inteligencia.camada c where c.codigo = '{camada}';"
            )

        # Metadados do conjunto de dados (Perfil MGB 2.0) ------------------------------------------------
        sql.append(
            "insert into metadados.conjunto_dados (projeto_id, levantamento_id, titulo, resumo, palavras_chave, responsavel_nome, "
            "escala_denominador, acuracia_posicional_m, metodo_avaliacao, linhagem, data_referencia, licenca, extensao) values "
            f"({pid}, {pid}, {q('Levantamento cadastral do ' + cfg['nome'])}, "
            f"{q('Unidades, quadras, perímetro e vértices do núcleo, com cadastro socioeconômico associado. Dados de demonstração.')}, "
            "array['REURB','cadastro territorial','LADM','regularização fundiária','Viçosa'], "
            f"{q(cfg['responsavel'])}, 500, 0.08, 'Propagação dos desvios-padrão por vértice (ISO 19157)', "
            f"{q('Geometria derivada de edificações do OpenStreetMap (ODbL); atributos gerados por script para demonstração.')}, "
            f"'{(inicio + timedelta(days=100)).isoformat()}', 'ODbL 1.0 (geometria); dados fictícios', "
            f"ST_Envelope(ST_GeomFromText('{geo(nuc['perimetro']).wkt}', 4674)));"
        )

    sql += [
        "select setval('reurb.projeto_id_seq', (select max(id) from reurb.projeto));",
        "select setval('campo.levantamento_id_seq', (select max(id) from campo.levantamento));",
        "commit;",
    ]
    destino = RAIZ / "db/seed/seed.sql"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text("\n".join(sql) + "\n", encoding="utf-8")
    print(f"ok: {len(PROJETOS)} núcleos, {total} unidades → {destino.relative_to(RAIZ)}")


if __name__ == "__main__":
    gerar()
