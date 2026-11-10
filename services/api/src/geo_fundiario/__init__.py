"""Geo-Fundiário — API da plataforma aberta de gestão fundiária e territorial."""


def main() -> None:
    import uvicorn

    uvicorn.run("geo_fundiario.main:app", port=8000)
