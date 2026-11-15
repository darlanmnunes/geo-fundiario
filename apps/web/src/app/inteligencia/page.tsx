import { DossieTerritorial } from "@/components/dossie-territorial";
import { Cabecalho, Etiqueta, Pagina, Painel } from "@/components/ui";
import { normaCitada } from "@/lib/dominio";
import { camadasConsultadas, camadasMapa, listarProjetos } from "@/lib/dados";

export const metadata = { title: "Inteligência territorial" };

export default function Inteligencia() {
  const projetos = listarProjetos();
  const camadas = camadasConsultadas();
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

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Painel titulo="Temas do diagnóstico e seus conectores" aside={`${camadas.filter((c) => c.situacao === "ao_vivo").length} de ${camadas.length} ligados em tempo real`} corpo="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-borda bg-realce text-left text-[12.5px] text-texto-2">
                  <th scope="col" className="px-3.5 py-2 font-semibold">Tema</th>
                  <th scope="col" className="px-3.5 py-2 font-semibold">Fontes</th>
                  <th scope="col" className="px-3.5 py-2 font-semibold">Base legal</th>
                  <th scope="col" className="px-3.5 py-2 font-semibold">Conector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {camadas.map((c) => {
                  const n = normaCitada(c.base);
                  return (
                    <tr key={c.nome} className="align-top">
                      <td className="px-3.5 py-1.5 font-semibold">{c.nome}</td>
                      <td className="px-3.5 py-1.5 text-texto-2">{c.fonte}</td>
                      <td className="px-3.5 py-1.5 text-texto-2">{n ? <a href={n.url} target="_blank" rel="noreferrer" className="text-azul hover:underline">{c.base}</a> : c.base}</td>
                      <td className="px-3.5 py-1.5 whitespace-nowrap">
                        <Etiqueta tom={c.situacao === "ao_vivo" ? "verde" : "neutro"}>{c.situacao === "ao_vivo" ? "Ao vivo" : "Previsto"}</Etiqueta>
                        {c.conector && <span className="cod ml-1.5 text-[12px] text-texto-3">{c.conector}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Painel>
        <Painel titulo="Como o dossiê é montado">
          <ol className="list-decimal space-y-2 pl-5 text-[13.5px] leading-relaxed text-texto-2">
            <li>O perímetro do núcleo é cadastrado (desenhado, importado ou vindo do levantamento).</li>
            <li>Para cada tema, um conector consulta a fonte oficial (WFS, API ou arquivo) em tempo real e cruza a resposta com o perímetro no PostGIS.</li>
            <li>Cada achado recebe severidade, implicação e base legal. O conjunto alimenta o estudo preliminar (Lei 13.465/2017, art. 35, III).</li>
          </ol>
          <p className="mt-3 border-t border-borda pt-3 text-[13px] leading-relaxed text-texto-3">
            Hoje um conector está ligado (hidrografia, pelo OpenStreetMap). Os demais temas mostram valores simulados e têm o conector previsto no catálogo: ligar uma fonte nova é escrever um conector, sem mudar esta tela.
          </p>
        </Painel>
      </div>
    </Pagina>
  );
}
