import { DossieTerritorial } from "@/components/dossie-territorial";
import Link from "next/link";
import { Cabecalho, Pagina, Painel } from "@/components/ui";
import { camadasConsultadas, camadasMapa, listarProjetos } from "@/lib/dados";

export const metadata = { title: "Inteligência territorial" };

export default function Inteligencia() {
  const projetos = listarProjetos();
  const camadas = camadasConsultadas();
  const ligados = camadas.filter((c) => c.situacao === "ao_vivo").length;
  return (
    <Pagina>
      <Cabecalho
        titulo="Inteligência territorial"
        descricao="O que o território diz sobre cada núcleo: o que impede, o que condiciona e o que só pede atenção, com fonte e base legal em cada achado."
      />
      <div className="mt-4">
        <DossieTerritorial
          camadas={camadasMapa(projetos)}
          nucleos={projetos.map((p) => ({ id: p.id, nome: p.nome, modalidade: p.modalidade, area_ha: p.area_nucleo_m2 / 10_000, unidades: p.lotes.features.length, dossie: p.dossie }))}
        />
      </div>

      <Painel titulo="Como o dossiê é montado" className="mt-4">
        <ol className="list-decimal space-y-2 pl-5 text-[13.5px] leading-relaxed text-texto-2">
          <li>O perímetro do núcleo é cadastrado (desenhado, importado ou vindo do levantamento).</li>
          <li>O <Link href="/diagnostico" className="font-semibold text-azul hover:underline">Diagnóstico territorial</Link> consulta as fontes oficiais em tempo real e cruza cada resposta com o perímetro. Hoje {ligados} de {camadas.length} temas têm fonte ligada.</li>
          <li>Quem tem perfil de editor grava o resultado no dossiê. Cada achado fica com severidade, consequência e base legal, e a nota de aptidão é recalculada.</li>
          <li>O dossiê alimenta o estudo preliminar do núcleo (Lei 13.465/2017, art. 35, III). Os temas sem fonte ligada continuam com valor de demonstração, sempre declarado.</li>
        </ol>
      </Painel>
    </Pagina>
  );
}
