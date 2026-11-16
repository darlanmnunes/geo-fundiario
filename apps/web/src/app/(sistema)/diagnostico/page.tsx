import { DiagnosticoTerritorial } from "@/components/diagnostico-territorial";
import { Cabecalho, Pagina } from "@/components/ui";
import { camadasConsultadas, camadasMapa, listarProjetos } from "@/lib/dados";

export const metadata = { title: "Diagnóstico territorial" };

export default function Diagnostico() {
  const projetos = listarProjetos();
  return (
    <Pagina>
      <Cabecalho
        titulo="Diagnóstico territorial"
        descricao="O que as bases oficiais dizem sobre uma área, consultadas na hora: sobreposições, distâncias e restrições, com a fonte e as feições que sustentam cada resultado."
      />
      <div className="mt-4">
        <DiagnosticoTerritorial
          camadas={camadasMapa(projetos)}
          catalogo={camadasConsultadas()}
          nucleos={projetos.map((p) => ({ id: p.id, nome: p.nome, municipio: `${p.municipio}/${p.uf}`, area_ha: p.area_nucleo_m2 / 10_000, unidades: p.lotes.features.length }))}
        />
      </div>
    </Pagina>
  );
}
