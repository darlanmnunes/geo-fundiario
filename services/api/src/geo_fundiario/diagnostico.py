"""Diagnóstico territorial: cada tema é respondido por um CONECTOR que consulta a fonte oficial em tempo real.

Um conector recebe a ÁREA de estudo (perímetro no UTM do projeto, unidades, caixa geográfica, município) e
devolve um achado: severidade, resultado, implicação, métricas e as feições que servem de evidência.
O catálogo (inteligencia.camada) diz qual conector atende cada tema, em que endereço, e se ele já está
ligado ("ao_vivo") ou só previsto. Para acrescentar uma fonte, escreve-se uma função e registra-se em
CONECTORES; nada mais muda na API nem na interface.

Os endereços e nomes de camada usados aqui foram conferidos em novembro de 2026 (docs/diagnostico-territorial.md).
Serviços públicos mudam de endereço sem aviso: por isso tudo isso fica no catálogo do banco, não no código.
"""

from __future__ import annotations

import json
import ssl
import urllib.parse
import urllib.request
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import UTC, datetime
from time import monotonic

import truststore
from pyproj import Transformer
from shapely import wkb
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform as reprojetar
from shapely.validation import make_valid

from geo_fundiario.banco import consulta, pool

FAIXA_APP_M = 30.0
ENTORNO_M = 500.0  # raio de busca padrão em volta do perímetro
TEMPO_LIMITE_S = 25
AGENTE = "diagnostico-territorial/1.0"
MAX_EVIDENCIAS = 40
MAX_RESPOSTA_BYTES = 12 * 1024 * 1024


# ----------------------------------------------------------------------------------------------------
# Área de estudo
# ----------------------------------------------------------------------------------------------------
@dataclass
class Area:
    perimetro: BaseGeometry  # no UTM do projeto, em metros
    unidades: list[BaseGeometry]
    srid: int
    uf: str | None = None
    municipio_ibge: str | None = None
    projeto_id: int | None = None
    _para_geo: Callable = field(init=False, repr=False)
    _para_utm: Callable = field(init=False, repr=False)

    def __post_init__(self):
        self._para_geo = Transformer.from_crs(self.srid, 4674, always_xy=True).transform
        self._para_utm = Transformer.from_crs(4674, self.srid, always_xy=True).transform

    def caixa(self, entorno_m: float = ENTORNO_M) -> tuple[float, float, float, float]:
        """Caixa em SIRGAS 2000 (oeste, sul, leste, norte) do perímetro mais o entorno."""
        return reprojetar(self._para_geo, self.perimetro.buffer(entorno_m)).bounds

    def utm(self, g: BaseGeometry) -> BaseGeometry:
        return reprojetar(self._para_utm, g)

    def geo(self, g: BaseGeometry) -> BaseGeometry:
        return reprojetar(self._para_geo, g)

    @property
    def area_m2(self) -> float:
        return self.perimetro.area


@dataclass
class Feicao:
    geom: BaseGeometry  # no UTM da área
    props: dict


# ----------------------------------------------------------------------------------------------------
# Acesso às fontes
# ----------------------------------------------------------------------------------------------------
# Certificados conferidos pelo repositório do sistema operacional, que completa cadeias que alguns servidores
# públicos enviam sem o certificado intermediário. A validação nunca é desligada.
_TLS = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
# Alguns servidores só negociam cifras antigas. O certificado continua sendo validado; só a lista de cifras
# aceitas é ampliada, e apenas para os servidores marcados com "tls_legado" no catálogo.
_TLS_LEGADO = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
_TLS_LEGADO.set_ciphers("DEFAULT:@SECLEVEL=1")
SERVIDORES_TLS_LEGADO: set[str] = set()


def _baixar(url: str, dados: bytes | None = None, cabecalhos: dict | None = None, tempo: int = TEMPO_LIMITE_S):
    if not url.lower().startswith("https://"):
        raise ValueError("Só fontes em https são consultadas")
    contexto = _TLS_LEGADO if urllib.parse.urlsplit(url).hostname in SERVIDORES_TLS_LEGADO else _TLS
    req = urllib.request.Request(url, data=dados, headers={"User-Agent": AGENTE, "Accept": "application/json", **(cabecalhos or {})})
    with urllib.request.urlopen(req, timeout=tempo, context=contexto) as resp:  # noqa: S310 — endereço vem do catálogo do banco e é https
        corpo = resp.read(MAX_RESPOSTA_BYTES + 1)
    if len(corpo) > MAX_RESPOSTA_BYTES:
        raise ValueError("Resposta da fonte grande demais")
    return json.loads(corpo)


def _geometria(area: Area, bruta: dict | None) -> BaseGeometry | None:
    if not bruta:
        return None
    g = shape(bruta)
    if g.is_empty:
        return None
    g = area.utm(g)
    return g if g.is_valid else make_valid(g)


def wfs(area: Area, endpoint: str, camada: str, entorno_m: float = ENTORNO_M, limite: int = 300, tempo: int = TEMPO_LIMITE_S) -> list[Feicao]:
    """GetFeature em WFS 1.0.0 (caixa em lon,lat; resposta GeoJSON em SIRGAS 2000)."""
    o, s, e, n = area.caixa(entorno_m)
    q = urllib.parse.urlencode({
        "service": "WFS", "version": "1.0.0", "request": "GetFeature", "typeName": camada, "maxFeatures": limite,
        "outputFormat": "application/json", "bbox": f"{o:.6f},{s:.6f},{e:.6f},{n:.6f}",
    })  # fmt: skip
    resposta = _baixar(f"{endpoint}?{q}", tempo=tempo)
    saida = []
    for f in resposta.get("features", []):
        g = _geometria(area, f.get("geometry"))
        if g is not None and g.distance(area.perimetro) <= entorno_m + 1:
            saida.append(Feicao(g, f.get("properties") or {}))
    return saida


def _esri_para_geojson(g: dict) -> dict | None:
    if "rings" in g:
        return {"type": "MultiPolygon", "coordinates": [[anel] for anel in g["rings"]]} if g["rings"] else None
    if "paths" in g:
        return {"type": "MultiLineString", "coordinates": g["paths"]} if g["paths"] else None
    if "x" in g and g["x"] is not None:
        return {"type": "Point", "coordinates": [g["x"], g["y"]]}
    return None


def arcgis(area: Area, camada_url: str, entorno_m: float = ENTORNO_M, limite: int = 300, campos: str = "*") -> list[Feicao]:
    """Consulta espacial em camada de MapServer/FeatureServer (ArcGIS REST), por envelope em SIRGAS 2000."""
    o, s, e, n = area.caixa(entorno_m)
    q = urllib.parse.urlencode({
        "where": "1=1", "geometry": f"{o:.6f},{s:.6f},{e:.6f},{n:.6f}", "geometryType": "esriGeometryEnvelope", "inSR": 4674,
        "spatialRel": "esriSpatialRelIntersects", "outFields": campos, "returnGeometry": "true", "outSR": 4674,
        "resultRecordCount": limite, "f": "json",
    })  # fmt: skip
    try:
        resposta = _baixar(f"{camada_url}/query?{q}", tempo=12)
    except TimeoutError:  # estes servidores oscilam: uma segunda tentativa costuma responder
        resposta = _baixar(f"{camada_url}/query?{q}", tempo=18)
    if "error" in resposta:
        raise ValueError(str(resposta["error"].get("message", "erro da fonte")))
    saida = []
    for f in resposta.get("features", []):
        g = _geometria(area, _esri_para_geojson(f.get("geometry") or {}))
        if g is not None and g.distance(area.perimetro) <= entorno_m + 1:
            saida.append(Feicao(g, f.get("attributes") or {}))
    return saida


# ----------------------------------------------------------------------------------------------------
# Análise espacial comum
# ----------------------------------------------------------------------------------------------------
@dataclass
class Relacao:
    feicao: Feicao
    dist_m: float
    sobreposicao_m2: float
    unidades: int

    @property
    def toca(self) -> bool:
        return self.dist_m < 0.5


def relacionar(area: Area, feicoes: list[Feicao]) -> list[Relacao]:
    """Distância ao perímetro, área sobreposta e unidades atingidas, da mais próxima para a mais distante."""
    saida = []
    for f in feicoes:
        dist = f.geom.distance(area.perimetro)
        sobre = f.geom.intersection(area.perimetro).area if dist < 0.5 and f.geom.geom_type.endswith("Polygon") else 0.0
        atingidas = sum(1 for u in area.unidades if u.intersects(f.geom)) if dist < 0.5 else 0
        saida.append(Relacao(f, dist, sobre, atingidas))
    return sorted(saida, key=lambda r: (r.dist_m, -r.sobreposicao_m2))


def evidencias(area: Area, relacoes: list[Relacao], rotulo: Callable[[dict], str], entorno_m: float = ENTORNO_M) -> list[dict]:
    """Feições em GeoJSON (SIRGAS 2000), recortadas ao entorno e simplificadas, para o mapa do dossiê."""
    janela = area.perimetro.buffer(entorno_m).envelope
    saida = []
    for r in relacoes[:MAX_EVIDENCIAS]:
        g = r.feicao.geom.intersection(janela)
        if g.is_empty:
            continue
        g = area.geo(g.simplify(1.0))
        saida.append({
            "type": "Feature",
            "geometry": json.loads(json.dumps(mapping(g)), parse_float=lambda x: round(float(x), 6)),
            "properties": {"rotulo": rotulo(r.feicao.props)[:120], "dist_m": round(r.dist_m, 1), "toca": r.toca},
        })  # fmt: skip
    return saida


def _pct(parte: float, todo: float) -> str:
    return f"{100 * parte / todo:.0f}%".replace(".", ",") if todo else "0%"


def _dist(m: float) -> str:
    return f"{m:.0f} m" if m < 1000 else f"{m / 1000:.1f} km".replace(".", ",")


def _lista(nomes: list[str], maximo: int = 3) -> str:
    nomes = [n for n in dict.fromkeys(n.strip() for n in nomes if n and n.strip())]
    if not nomes:
        return ""
    resto = len(nomes) - maximo
    return ", ".join(nomes[:maximo]) + (f" e mais {resto}" if resto > 0 else "")


def _achado(severidade: str, resultado: str, implicacao: str | None = None, metricas: dict | None = None, feicoes: list[dict] | None = None) -> dict:
    return {"severidade": severidade, "resultado": resultado, "implicacao": implicacao, "metricas": metricas or {}, "evidencias": feicoes or []}


# ----------------------------------------------------------------------------------------------------
# Conectores
# ----------------------------------------------------------------------------------------------------
def osm_hidrografia(area: Area, endpoint: str, par: dict) -> dict:
    """Corpos d'água do OpenStreetMap a até 150 m do perímetro, via Overpass."""
    oeste, sul, leste, norte = area.caixa(150)
    caixa = f"{sul:.6f},{oeste:.6f},{norte:.6f},{leste:.6f}"
    q = f'[out:json][timeout:25];(way["natural"="water"]({caixa});way["waterway"~"river|stream|canal"]({caixa}););out geom;'
    elementos, falha = None, None
    for servidor in [endpoint, *par.get("alternativos", [])]:  # os servidores públicos oscilam: tenta o próximo
        try:
            elementos = _baixar(servidor, dados=urllib.parse.urlencode({"data": q}).encode(), tempo=8)["elements"]
            break
        except Exception as erro:  # noqa: BLE001
            falha = erro
    aguas, nota = [], ""
    if elementos is None:
        # Sem resposta do OpenStreetMap: usa a hidrografia já guardada no banco para este núcleo, se houver.
        if area.projeto_id is None:
            raise falha or ConnectionError("fonte fora do ar")
        guardadas = consulta(
            """select nome, ST_AsBinary(ST_Transform(geom, %s)) g from reurb.hidrografia
                where projeto_id = %s and ST_DWithin(ST_Transform(geom, %s), ST_GeomFromWKB(%s, %s), 150)""",
            area.srid, area.projeto_id, area.srid, area.perimetro.wkb, area.srid,
        )  # fmt: skip
        aguas = [Feicao(wkb.loads(bytes(r["g"])), {"name": r["nome"]}) for r in guardadas]
        nota = " O servidor do OpenStreetMap não respondeu agora; resultado calculado sobre a hidrografia guardada no banco."
        elementos = []
    for el in elementos:
        pts = [(p["lon"], p["lat"]) for p in el.get("geometry", [])]
        if len(pts) >= 2:
            g = Polygon(pts) if pts[0] == pts[-1] and len(pts) >= 4 and "waterway" not in el.get("tags", {}) else LineString(pts)
            aguas.append(Feicao(area.utm(g), el.get("tags", {})))
    if not aguas:
        return _achado("ok", "Nenhum corpo d'água a menos de 150 m do perímetro." + nota, metricas={"distancia_min_m": None})
    rel = relacionar(area, aguas)
    dist = rel[0].dist_m
    na_faixa = sum(1 for u in area.unidades if min(a.geom.distance(u) for a in aguas) < FAIXA_APP_M)
    metricas = {"distancia_min_m": round(dist, 1), "unidades_na_faixa": na_faixa, "faixa_m": FAIXA_APP_M, "feicoes": len(aguas)}
    ev = evidencias(area, rel, lambda p: p.get("name") or "Corpo d'água", 150)
    if na_faixa:
        margem = "o perímetro toca a margem" if dist < 1 else f"o perímetro fica a {dist:.0f} m da margem mais próxima"
        return _achado("condiciona", f"{na_faixa} de {len(area.unidades)} unidades a menos de {FAIXA_APP_M:.0f} m de corpo d'água; {margem}.{nota}",
                       "Faixa não edificável de 15 m (REURB-E) ou estudo técnico com melhoria ambiental (REURB-S, art. 64).", metricas, ev)  # fmt: skip
    return _achado("atencao", f"Corpo d'água a {dist:.0f} m do perímetro; nenhuma unidade na faixa de {FAIXA_APP_M:.0f} m.{nota}",
                   "Registrar no estudo técnico ambiental; sem restrição direta às unidades.", metricas, ev)  # fmt: skip


def ana_cursos_dagua(area: Area, endpoint: str, _: dict) -> dict:
    """Cursos d'água da Base Hidrográfica Ottocodificada (ANA), com nome e dominialidade."""
    rel = relacionar(area, arcgis(area, endpoint, 300))
    if not rel:
        return _achado("ok", "Nenhum curso d'água da base hidrográfica da ANA a menos de 300 m do perímetro.")
    p = rel[0].feicao.props
    nome = (p.get("NORIOCOMP") or "").strip() or "curso d'água sem nome na base"
    dominio = (p.get("DEDOMINIAL") or "").strip().lower()
    metricas = {"distancia_min_m": round(rel[0].dist_m, 1), "trechos": len(rel), "curso_mais_proximo": nome, "dominialidade": dominio or None}
    onde = "cruza ou toca o perímetro" if rel[0].toca else f"passa a {_dist(rel[0].dist_m)} do perímetro"
    texto = f"{nome[0].upper()}{nome[1:]} {onde}" + (f"; domínio {dominio}." if dominio else ".")
    return _achado("atencao" if rel[0].dist_m < 100 else "ok", texto,
                   "A dominialidade define o órgão que outorga e fiscaliza: ANA se federal, órgão gestor estadual se estadual.",
                   metricas, evidencias(area, rel, lambda q: q.get("NORIOCOMP") or "Curso d'água", 300))  # fmt: skip


def sgb_risco(area: Area, endpoint: str, _: dict) -> dict:
    """Setores de risco geológico mapeados pelo Serviço Geológico do Brasil."""
    rel = relacionar(area, arcgis(area, endpoint, 300))
    if not rel:
        return _achado("ok", "Nenhum setor de risco geológico mapeado pelo SGB a menos de 300 m. Municípios não setorizados também aparecem assim.",
                       "Confirmar com a Defesa Civil municipal se o município foi setorizado.")  # fmt: skip
    dentro = [r for r in rel if r.toca]
    ev = evidencias(area, rel, lambda p: f"{p.get('num_setor') or 'Setor'} - risco {p.get('grau_risco') or 'não informado'}", 300)
    if dentro:
        graus = _lista([str(r.feicao.props.get("grau_risco") or "") for r in dentro])
        tipos = _lista([str(r.feicao.props.get("tipolo_g1") or "") for r in dentro])
        unidades = sum(1 for u in area.unidades if any(u.intersects(r.feicao.geom) for r in dentro))
        sobre = sum(r.sobreposicao_m2 for r in dentro)
        return _achado("condiciona",
                       f"{len(dentro)} setor(es) de risco sobre o perímetro ({_pct(sobre, area.area_m2)} da área), grau {graus or 'não informado'}"
                       + (f", tipologia {tipos.lower()}" if tipos else "") + f"; {unidades} de {len(area.unidades)} unidades atingidas.",
                       "Exige estudo técnico de risco; se o risco não puder ser eliminado ou corrigido, as famílias são realocadas.",
                       {"setores": len(dentro), "unidades_atingidas": unidades, "area_sobreposta_m2": round(sobre), "ano": str(dentro[0].feicao.props.get("data_setor") or "")[:4] or None}, ev)  # fmt: skip
    return _achado("atencao", f"Setor de risco mais próximo a {_dist(rel[0].dist_m)} do perímetro (grau {rel[0].feicao.props.get('grau_risco') or 'não informado'}); nenhum sobre o núcleo.",
                   "Registrar no estudo técnico; avaliar se o processo que gera o risco alcança o núcleo.", {"distancia_min_m": round(rel[0].dist_m, 1), "setores_no_entorno": len(rel)}, ev)  # fmt: skip


def ibge_setores(area: Area, endpoint: str, par: dict) -> dict:
    """Setores censitários 2022, áreas urbanizadas e favelas e comunidades urbanas (IBGE)."""
    base = endpoint.rstrip("/")
    setores = [r for r in relacionar(area, wfs(area, f"{base}/CGMAT/ows", par.get("setores", "CGMAT:pbqg22_26_SetoresCensitarios_SetoresCensitarios"), 0)) if r.sobreposicao_m2 > 1]
    partes, metricas, ev = [], {"setores": [r.feicao.props.get("cd_setor") for r in setores]}, []
    if setores:
        situacoes = _lista([str(r.feicao.props.get("nm_sit") or "") for r in setores], 2)
        partes.append(f"Perímetro sobre {len(setores)} setor(es) censitário(s) de 2022" + (f", situação {situacoes.lower()}" if situacoes else ""))
    urbana = False
    try:
        au = [r for r in relacionar(area, wfs(area, f"{base}/CGEO/ows", par.get("urbanizadas", "CGEO:AU_2026_AreasUrbanizadas2022_Brasil"), 0)) if r.toca]
        coberta = sum(r.sobreposicao_m2 for r in au)
        urbana = coberta > 0
        metricas["pct_area_urbanizada"] = round(100 * coberta / area.area_m2) if area.area_m2 else 0
        partes.append(f"{_pct(coberta, area.area_m2)} da área dentro de área urbanizada mapeada pelo IBGE (2022)")
    except Exception:  # noqa: BLE001 — camada complementar; a falta dela não derruba o tema
        metricas["pct_area_urbanizada"] = None
    try:
        fcu = [r for r in relacionar(area, wfs(area, f"{base}/CGMAT/ows", par.get("fcu", "CGMAT:qg_2022_670_fcu_agreg"), 0)) if r.toca]
        metricas["favelas_comunidades"] = [r.feicao.props.get("nm_fcu") for r in fcu]
        if fcu:
            partes.append(f"sobrepõe a favela ou comunidade urbana {_lista([str(r.feicao.props.get('nm_fcu')) for r in fcu])}")
    except Exception:  # noqa: BLE001
        metricas["favelas_comunidades"] = None
    if not partes:
        return _achado("sem_dado", "O IBGE não devolveu setor censitário para esta área.", "Tentar de novo mais tarde.", metricas)
    sev = "ok" if urbana or not setores or "urban" in str(setores[0].feicao.props.get("nm_sit", "")).lower() else "atencao"
    return _achado(sev, "; ".join(partes) + ".",
                   None if sev == "ok" else "Área fora da mancha urbanizada do IBGE: demonstrar no projeto as características urbanas do núcleo (Lei 13.465/2017, art. 11, I).",
                   metricas, ev)  # fmt: skip


def ibge_municipio(area: Area, endpoint: str, _: dict) -> dict:
    """População, domicílios e densidade do município no Censo 2022 (SIDRA)."""
    if not area.municipio_ibge:
        return _achado("sem_dado", "Município da área não identificado.", "Informar o código IBGE do município no projeto.")
    base = endpoint.rstrip("/")

    def tabela(numero: int) -> dict[str, str]:
        linhas = _baixar(f"{base}/values/t/{numero}/n6/{area.municipio_ibge}/v/all/p/last")
        return {str(x.get("D2N")): str(x.get("V")) for x in linhas[1:]}

    def numero(valores: dict, trecho: str) -> float | None:
        for nome, v in valores.items():
            if trecho in nome.lower():
                try:
                    return float(v)
                except ValueError:
                    return None
        return None

    pop_t, dom_t = tabela(4714), tabela(4712)
    pop, dens = numero(pop_t, "população residente"), numero(pop_t, "densidade")
    dom, media = numero(dom_t, "domicílios particulares permanentes ocupados"), numero(dom_t, "média de moradores")
    if pop is None:
        return _achado("sem_dado", "O SIDRA não devolveu a população do município.", "Tentar de novo mais tarde.")

    def br(v: float, casas: int = 0) -> str:
        return f"{v:,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")

    texto = f"Município com {br(pop)} habitantes no Censo 2022"
    if dom:
        texto += f", {br(dom)} domicílios ocupados"
    if media:
        texto += f", média de {br(media, 2)} moradores por domicílio"
    if dens:
        texto += f" e densidade de {br(dens, 1)} hab/km²"
    return _achado("ok", texto + ".", "Referência para dimensionar o cadastro social e comparar o perfil do núcleo com o do município.",
                   {"populacao": pop, "domicilios": dom, "moradores_por_domicilio": media, "densidade_hab_km2": dens})  # fmt: skip


def sicar_imoveis(area: Area, endpoint: str, _: dict) -> dict:
    """Imóveis rurais inscritos no Cadastro Ambiental Rural (SICAR), uma camada por UF."""
    if not area.uf:
        return _achado("sem_dado", "UF da área não identificada.", "Informar a UF no projeto.")
    rel = relacionar(area, wfs(area, endpoint, f"sicar:sicar_imoveis_{area.uf.lower()}", 200))
    situacao = {"AT": "ativo", "PE": "pendente", "SU": "suspenso", "CA": "cancelado"}
    ev = evidencias(area, rel, lambda p: f"CAR {p.get('cod_imovel')} ({situacao.get(str(p.get('status_imovel')), p.get('status_imovel'))})", 200)
    dentro = [r for r in rel if r.sobreposicao_m2 > 1]
    if dentro:
        sobre = sum(r.sobreposicao_m2 for r in dentro)
        codigos = [str(r.feicao.props.get("cod_imovel")) for r in dentro]
        estados = _lista([situacao.get(str(r.feicao.props.get("status_imovel")), str(r.feicao.props.get("status_imovel"))) for r in dentro])
        return _achado("atencao", f"{len(dentro)} imóvel(is) do CAR sobre o perímetro ({_pct(sobre, area.area_m2)} da área), situação {estados}: {_lista(codigos, 2)}.",
                       "Área cadastrada como rural: conferir a matrícula de origem e, concluída a REURB, pedir a retificação ou o cancelamento do CAR na parte urbana.",
                       {"imoveis": codigos, "area_sobreposta_m2": round(sobre)}, ev)  # fmt: skip
    if rel:
        return _achado("ok", f"Nenhum imóvel do CAR sobre o perímetro; o mais próximo fica a {_dist(rel[0].dist_m)}.", metricas={"imoveis_no_entorno": len(rel)}, feicoes=ev)
    return _achado("ok", "Nenhum imóvel do CAR sobre o perímetro nem a menos de 200 m.")


def incra_territorios(area: Area, endpoint: str, par: dict) -> dict:
    """Projetos de assentamento e territórios quilombolas (INCRA), pelo serviço público que os republica."""
    achados, ev, falhas = [], [], 0
    for camada, tipo, nome in (
        (par.get("assentamentos", "CMR-PUBLICO:lim_assentamento_rural_a"), "assentamento", "no_projeto"),
        (par.get("quilombolas", "CMR-PUBLICO:lim_quilombolas_a"), "território quilombola", "no_comunidade"),
    ):
        try:
            rel = relacionar(area, wfs(area, endpoint, camada, 1000))
        except Exception:  # noqa: BLE001
            falhas += 1
            continue
        ev += evidencias(area, rel, lambda p, t=tipo, n=nome: f"{t.capitalize()} {p.get(n) or ''}".strip(), 1000)
        achados += [(tipo, r.feicao.props.get(nome) or "sem nome", r) for r in rel]
    if falhas == 2:
        raise ConnectionError("fonte fora do ar")
    dentro = [a for a in achados if a[2].toca]
    if dentro:
        nomes = _lista([f"{t} {n}" for t, n, _ in dentro])
        return _achado("condiciona", f"O perímetro sobrepõe {nomes}.",
                       "Área sob gestão do INCRA: a regularização depende de anuência do órgão e, em território quilombola, segue o Dec. 4.887/2003.",
                       {"sobrepostos": [n for _, n, _ in dentro]}, ev)  # fmt: skip
    if achados:
        t, n, r = min(achados, key=lambda a: a[2].dist_m)
        return _achado("ok", f"Nenhum assentamento ou território quilombola sobre o perímetro; o mais próximo ({t} {n}) fica a {_dist(r.dist_m)}.", metricas={"no_entorno": len(achados)}, feicoes=ev)
    return _achado("ok", "Nenhum assentamento do INCRA nem território quilombola sobre o perímetro ou a menos de 1 km.")


def unidades_conservacao_ti(area: Area, endpoint: str, par: dict) -> dict:
    """Unidades de conservação federais (ICMBio) e terras indígenas (FUNAI)."""
    raio, itens, ev, falhas = 3000, [], [], 0
    fontes = (
        (endpoint, par.get("uc", "ICMBio:limiteucsfederais_a"), "uc"),
        (par.get("funai", "https://geoserver.funai.gov.br/geoserver/Funai/ows"), par.get("ti", "Funai:tis_poligonais"), "ti"),
    )
    for url, camada, tipo in fontes:
        try:
            rel = relacionar(area, wfs(area, url, camada, raio, limite=50, tempo=40))
        except Exception:  # noqa: BLE001
            falhas += 1
            continue
        nome = (lambda p: p.get("nomeuc") or "UC") if tipo == "uc" else (lambda p: f"TI {p.get('terrai_nome') or ''}".strip())
        ev += evidencias(area, rel, nome, raio)
        itens += [(tipo, nome(r.feicao.props), r) for r in rel]
    if falhas == 2:
        raise ConnectionError("fontes fora do ar")
    aviso = " Uma das duas fontes não respondeu." if falhas else ""
    dentro = [i for i in itens if i[2].toca]
    if dentro:
        protecao_integral = any(t == "uc" and str(r.feicao.props.get("grupouc", "")).upper().startswith("PI") for t, _, r in dentro)
        indigena = any(t == "ti" for t, _, _ in dentro)
        if indigena:
            consequencia = "Terra indígena é bem da União de usufruto exclusivo dos povos indígenas (CF, art. 231): a REURB não se aplica à área sobreposta."
        elif protecao_integral:
            consequencia = "UC de proteção integral não admite ocupação: a área sobreposta sai do perímetro ou depende de desafetação por lei."
        else:
            consequencia = "UC de uso sustentável: exige anuência do órgão gestor e compatibilidade com o plano de manejo (Lei 13.465/2017, art. 11, §3º)."
        return _achado("impede" if indigena or protecao_integral else "condiciona", f"O perímetro sobrepõe {_lista([n for _, n, _ in dentro])}.{aviso}", consequencia,
                       {"sobrepostos": [n for _, n, _ in dentro]}, ev)  # fmt: skip
    if itens:
        _, n, r = min(itens, key=lambda i: i[2].dist_m)
        return _achado("atencao", f"Fora de UC federal e de terra indígena; a mais próxima ({n}) fica a {_dist(r.dist_m)}.{aviso}",
                       "Conferir no plano de manejo se o núcleo está na zona de amortecimento. UCs estaduais e municipais não entram nesta consulta.", {"distancia_min_m": round(r.dist_m)}, ev)  # fmt: skip
    return _achado("ok", f"Fora de UC federal e de terra indígena, e nenhuma a menos de 3 km.{aviso}", "UCs estaduais e municipais não entram nesta consulta: conferir com o órgão ambiental do estado e do município.")


def iphan_bens(area: Area, endpoint: str, par: dict) -> dict:
    """Sítios arqueológicos e bens protegidos cadastrados no IPHAN."""
    itens, ev, falhas = [], [], 0
    camadas = ((par.get("sitios", "SICG:sitios"), "sítio arqueológico"), (par.get("poligonos", "SICG:bem_poligono"), "bem com poligonal"), (par.get("protecao", "SICG:Bem_Protecao"), "bem protegido"))
    for camada, tipo in camadas:
        try:
            rel = relacionar(area, wfs(area, endpoint, camada, 300))
        except Exception:  # noqa: BLE001
            falhas += 1
            continue
        ev += evidencias(area, rel, lambda p, t=tipo: f"{t.capitalize()}: {p.get('identificacao_bem') or 'sem nome'}", 300)
        itens += [(tipo, r.feicao.props.get("identificacao_bem") or "sem nome", r) for r in rel]
    if falhas == len(camadas):
        raise ConnectionError("fonte fora do ar")
    dentro = [i for i in itens if i[2].toca]
    if dentro:
        return _achado("condiciona", f"{len(dentro)} bem(ns) cadastrado(s) no IPHAN dentro do perímetro: {_lista([f'{n} ({t})' for t, n, _ in dentro])}.",
                       "Qualquer intervenção no bem ou no seu entorno depende de autorização do IPHAN.", {"bens": [n for _, n, _ in dentro]}, ev)  # fmt: skip
    if itens:
        t, n, r = min(itens, key=lambda i: i[2].dist_m)
        return _achado("atencao", f"Nenhum bem do IPHAN dentro do perímetro; {t} {n} a {_dist(r.dist_m)}.", "Verificar se o núcleo está na área de entorno do bem.", {"no_entorno": len(itens)}, ev)
    return _achado("ok", "Nenhum sítio arqueológico nem bem protegido federal no perímetro ou a menos de 300 m.", "Tombamentos estaduais e municipais não entram nesta consulta.")


def anm_processos(area: Area, endpoint: str, _: dict) -> dict:
    """Processos minerários ativos (ANM/SIGMINE). O titular não é trazido: pode ser pessoa física."""
    rel = relacionar(area, arcgis(area, endpoint, 0, campos="PROCESSO,FASE,SUBS,USO,AREA_HA,ULT_EVENTO"))
    dentro = [r for r in rel if r.sobreposicao_m2 > 1]
    if not dentro:
        return _achado("ok", "Nenhum processo minerário ativo sobre o perímetro.")
    fases = _lista([str(r.feicao.props.get("FASE") or "").lower() for r in dentro])
    subs = _lista([str(r.feicao.props.get("SUBS") or "").lower() for r in dentro])
    lavra = any("lavra" in str(r.feicao.props.get("FASE") or "").lower() or "licenciamento" in str(r.feicao.props.get("FASE") or "").lower() for r in dentro)
    return _achado("condiciona" if lavra else "atencao",
                   f"{len(dentro)} processo(s) minerário(s) sobre o perímetro, fase {fases}" + (f", substância {subs}" if subs else "") + f": {_lista([str(r.feicao.props.get('PROCESSO')) for r in dentro])}.",
                   "Com título de lavra, ouvir a ANM e o titular antes de aprovar o projeto. Em fase de requerimento ou pesquisa, basta registrar no processo.",
                   {"processos": [r.feicao.props.get("PROCESSO") for r in dentro]}, evidencias(area, dentro, lambda p: f"Processo ANM {p.get('PROCESSO')} - {p.get('FASE')}", 0))  # fmt: skip


def faixas_infraestrutura(area: Area, endpoint: str, par: dict) -> dict:
    """Rodovias federais (DNIT/SNV) e faixas de utilidade pública de energia (ANEEL)."""
    partes, ev, sev, metricas, falhas = [], [], "ok", {}, 0
    try:
        rod = relacionar(area, wfs(area, endpoint, par.get("snv", "DNIT:snv_202507a"), 300))
        ev += evidencias(area, rod, lambda p: f"BR-{p.get('vl_br')}", 300)
        if rod:
            r = rod[0]
            metricas["rodovia_federal_m"] = round(r.dist_m, 1)
            if r.dist_m < 55:
                sev = "condiciona"
                partes.append(f"eixo da BR-{r.feicao.props.get('vl_br')} a {r.dist_m:.0f} m do perímetro, perto o bastante para exigir consulta ao DNIT sobre a faixa de domínio")
            else:
                sev = "atencao"
                partes.append(f"BR-{r.feicao.props.get('vl_br')} a {_dist(r.dist_m)} do perímetro")
    except Exception:  # noqa: BLE001
        falhas += 1
    try:
        dup = [r for r in relacionar(area, arcgis(area, par.get("dup", "https://sigel.aneel.gov.br/arcgis/rest/services/DadosAbertos/DUP/MapServer/0"), 100)) if r.dist_m < 100]
        ev += evidencias(area, dup, lambda p: f"Faixa de utilidade pública: {p.get('EMPREEM') or 'energia'}", 100)
        if dup:
            dentro = [r for r in dup if r.toca]
            metricas["dup"] = [r.feicao.props.get("CODDUP") for r in dup]
            if dentro:
                sev = "condiciona"
                partes.append(f"faixa declarada de utilidade pública para energia sobre o perímetro ({_lista([str(r.feicao.props.get('EMPREEM')) for r in dentro])})")
            else:
                sev = "atencao" if sev == "ok" else sev
                partes.append(f"faixa de utilidade pública de energia a {_dist(dup[0].dist_m)}")
    except Exception:  # noqa: BLE001
        falhas += 1
    if falhas == 2:
        raise ConnectionError("fontes fora do ar")
    if not partes:
        return _achado("ok", "Nenhuma rodovia federal a menos de 300 m e nenhuma faixa de utilidade pública de energia a menos de 100 m.",
                       "Rodovias estaduais, ferrovias e dutos não entram nesta consulta.", metricas)  # fmt: skip
    texto = "; ".join(partes)
    return _achado(sev, texto[0].upper() + texto[1:] + ".",
                   "Ao longo de rodovia há faixa não edificável de 15 m além da faixa de domínio, redutível a 5 m por lei municipal; em faixa de servidão de energia, ouvir a concessionária.",
                   metricas, ev)  # fmt: skip


CONECTORES: dict[str, Callable[[Area, str, dict], dict]] = {
    "osm_hidrografia": osm_hidrografia,
    "ana_cursos_dagua": ana_cursos_dagua,
    "sgb_risco": sgb_risco,
    "ibge_setores": ibge_setores,
    "ibge_municipio": ibge_municipio,
    "sicar_imoveis": sicar_imoveis,
    "incra_territorios": incra_territorios,
    "unidades_conservacao_ti": unidades_conservacao_ti,
    "iphan_bens": iphan_bens,
    "anm_processos": anm_processos,
    "faixas_infraestrutura": faixas_infraestrutura,
}


# ----------------------------------------------------------------------------------------------------
# Execução
# ----------------------------------------------------------------------------------------------------
def catalogo() -> list[dict]:
    return consulta(
        """select c.codigo, c.nome, c.fontes_descricao fonte, c.base_legal base, c.conector, c.endpoint, c.parametros,
                  c.situacao_conector situacao, f.orgao, f.licenca
             from inteligencia.camada c left join inteligencia.fonte f on f.codigo = c.fonte_codigo order by c.ordem"""
    )


def _rodar(camada: dict, area: Area) -> dict:
    inicio = monotonic()
    comum = {"codigo": camada["codigo"], "camada": camada["nome"], "fonte": camada["fonte"], "base": camada["base"], "origem": "calculado"}
    par = camada["parametros"] or {}
    if par.get("tls_legado"):
        SERVIDORES_TLS_LEGADO.add(urllib.parse.urlsplit(camada["endpoint"]).hostname or "")
    try:
        achado = CONECTORES[camada["conector"]](area, camada["endpoint"], par)
    except Exception as erro:  # noqa: BLE001 — a fonte externa pode estar fora do ar; o dossiê não pode cair por isso
        achado = _achado("sem_dado", "A fonte não respondeu agora.", "Tentar de novo mais tarde.", {"erro": type(erro).__name__})
    return {**comum, **achado, "tempo_ms": round(1000 * (monotonic() - inicio))}


def diagnosticar_area(area: Area) -> dict:
    """Roda em paralelo todos os conectores ligados e devolve os achados (sem gravar)."""
    ligados = [c for c in catalogo() if c["situacao"] == "ao_vivo" and c["conector"] in CONECTORES]
    with ThreadPoolExecutor(max_workers=8) as fila:
        achados = list(fila.map(lambda c: _rodar(c, area), ligados))
    previstos = [{"codigo": c["codigo"], "camada": c["nome"], "fonte": c["fonte"]} for c in catalogo() if c["situacao"] != "ao_vivo"]
    return {"consultado_em": datetime.now(UTC).isoformat(timespec="seconds"), "achados": achados, "previstos": previstos}


def diagnosticar(pid: int) -> dict:
    """Diagnóstico do perímetro vigente de um núcleo cadastrado."""
    p = consulta(
        """select pr.srid_utm, pr.uf, pr.municipio_ibge, ST_AsBinary(ST_Transform(n.geom, pr.srid_utm)) g from reurb.projeto pr
             join ladm.la_spatialunit n on n.projeto_id = pr.id and n.nivel = 'nucleo' and n.end_lifespan_version is null
            where pr.id = %s""",
        pid,
    )
    if not p:
        return {}
    srid = p[0]["srid_utm"]
    unidades = [
        wkb.loads(bytes(r["g"]))
        for r in consulta(
            "select ST_AsBinary(ST_Transform(geom, %s)) g from ladm.la_spatialunit where projeto_id = %s and nivel = 'lote' and end_lifespan_version is null",
            srid,
            pid,
        )
    ]
    area = Area(wkb.loads(bytes(p[0]["g"])), unidades, srid, p[0]["uf"], (p[0]["municipio_ibge"] or "").strip() or None, pid)
    return {"projeto_id": pid, **diagnosticar_area(area)}


AREA_MAXIMA_HA = 5000.0


def diagnosticar_geojson(geometria: dict, uf: str | None, municipio_ibge: str | None) -> dict:
    """Diagnóstico de uma área de estudo livre (polígono em SIRGAS 2000 ou WGS 84, lon/lat)."""
    g = shape(geometria)
    if g.geom_type not in ("Polygon", "MultiPolygon") or g.is_empty:
        raise ValueError("A área de estudo precisa ser um polígono")
    g = g if g.is_valid else make_valid(g)
    oeste, sul, leste, norte = g.bounds
    if not box(-74.5, -34.5, -28.0, 6.0).contains(box(oeste, sul, leste, norte)):
        raise ValueError("A área precisa estar no Brasil, em graus (longitude, latitude)")
    centro = g.centroid
    fuso = int((centro.x + 180) // 6) + 1
    # SIRGAS 2000 / UTM: 18N a 22N = EPSG:31972 a 31976; 18S a 25S = EPSG:31978 a 31985
    srid = (31954 + fuso if 18 <= fuso <= 22 else 0) if centro.y >= 0 else (31960 + fuso if 18 <= fuso <= 25 else 0)
    if not srid:
        raise ValueError("Fuso UTM fora do território brasileiro")
    area = Area(reprojetar(Transformer.from_crs(4674, srid, always_xy=True).transform, g), [], srid, uf.upper() if uf else None, municipio_ibge)
    if area.area_m2 / 10000 > AREA_MAXIMA_HA:
        raise ValueError(f"Área de estudo acima de {AREA_MAXIMA_HA:.0f} ha")
    if not area.uf or not area.municipio_ibge:  # descobre pelo setor censitário que contém o centro
        try:
            setores = wfs(area, "https://geoservicos.ibge.gov.br/geoserver/CGMAT/ows", "CGMAT:pbqg22_26_SetoresCensitarios_SetoresCensitarios", 0, limite=5)
            if setores:
                area.uf = area.uf or setores[0].props.get("sigla_uf")
                area.municipio_ibge = area.municipio_ibge or setores[0].props.get("cd_mun")
        except Exception:  # noqa: BLE001, S110 — sem localização, os conectores que dependem dela respondem "sem dado"
            pass
    return {"area_ha": round(area.area_m2 / 10000, 4), "srid_utm": srid, "uf": area.uf, "municipio_ibge": area.municipio_ibge, **diagnosticar_area(area)}


def gravar_no_dossie(pid: int, autor: str | None) -> dict:
    """Consulta as fontes e grava no dossiê do núcleo os temas que responderam.

    O achado gravado substitui o anterior do mesmo tema (inclusive o valor de demonstração). Os temas cuja
    fonte não respondeu ficam como estavam. A nota de aptidão é recalculada a partir de todos os achados.
    """
    resultado = diagnosticar(pid)
    if not resultado:
        return {}
    respondidos = [a for a in resultado["achados"] if a["severidade"] != "sem_dado"]
    with pool.connection() as conn:
        if autor:
            conn.execute("select set_config('geof.usuario', %s, true)", (autor,))
        linha = conn.execute("select id from inteligencia.dossie where projeto_id = %s order by id desc limit 1", (pid,)).fetchone()
        if linha:
            dossie_id = linha["id"]
        else:
            criado = conn.execute(
                """insert into inteligencia.dossie (projeto_id, nome, geom, srid_utm)
                   select pr.id, 'Dossiê de ' || pr.nome, ST_Multi(n.geom), pr.srid_utm from reurb.projeto pr
                     join ladm.la_spatialunit n on n.projeto_id = pr.id and n.nivel = 'nucleo' and n.end_lifespan_version is null
                    where pr.id = %s returning id""",
                (pid,),
            ).fetchone()
            dossie_id = criado["id"]
        for a in respondidos:
            conn.execute("delete from inteligencia.achado where dossie_id = %s and camada_codigo = %s", (dossie_id, a["codigo"]))
            metricas = {**a["metricas"], "consultado_em": resultado["consultado_em"], "feicoes": len(a["evidencias"])}
            conn.execute(
                """insert into inteligencia.achado (dossie_id, camada_codigo, camada_nome, severidade, resultado, implicacao, base_legal, metricas, origem)
                   values (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, 'calculado')""",
                (dossie_id, a["codigo"], a["camada"], a["severidade"], a["resultado"], a["implicacao"], a["base"], json.dumps(metricas, default=str)),
            )
        todos = conn.execute("select severidade, origem from inteligencia.achado where dossie_id = %s", (dossie_id,)).fetchall()
        sev = [t["severidade"] for t in todos]
        nota = pontuar(sev)
        simulados = sum(1 for t in todos if t["origem"] == "simulado")
        conn.execute(
            "update inteligencia.dossie set pontuacao = %s, resumo = %s, gerado_em = now() where id = %s",
            (nota, resumir(sev, simulados), dossie_id),
        )
    return {"projeto_id": pid, "gravados": len(respondidos), "sem_resposta": [a["camada"] for a in resultado["achados"] if a["severidade"] == "sem_dado"],
            "pontuacao": nota, "consultado_em": resultado["consultado_em"]}  # fmt: skip


PESO = {"impede": 40, "condiciona": 12, "atencao": 4, "sem_dado": 2, "ok": 0}


def pontuar(severidades: list[str]) -> int:
    """Nota de aptidão de 0 a 100: parte de 100 e desconta por achado, conforme a severidade."""
    return max(0, 100 - sum(PESO.get(s, 0) for s in severidades))


def resumir(severidades: list[str], simulados: int = 0) -> str:
    n = {s: severidades.count(s) for s in PESO}
    partes = []
    if n["impede"]:
        partes.append(f"{n['impede']} tema(s) impedem o registro até serem resolvidos")
    if n["condiciona"]:
        partes.append(f"{n['condiciona']} exigem estudo, obra ou ato antes da aprovação")
    if n["atencao"]:
        partes.append(f"{n['atencao']} pedem registro e acompanhamento")
    texto = ("; ".join(partes) + ".") if partes else "Nenhuma restrição encontrada nos temas consultados."
    texto = texto[0].upper() + texto[1:]
    if simulados:
        texto += f" {simulados} tema(s) ainda trazem valor de demonstração."
    return texto
