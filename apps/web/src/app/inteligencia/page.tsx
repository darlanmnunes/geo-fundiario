import Link from "next/link";
import clsx from "clsx";
import { MapaNucleo } from "@/components/mapa-nucleo";
import { Cabecalho, Carimbo, Painel, Rotulo } from "@/components/ui";
import { camadasBase, listarProjetos, lotesParaMapa } from "@/lib/dados";
import { CAMADAS, listarDossies, SEVERIDADE, type Severidade } from "@/lib/inteligencia";
import { MODALIDADE } from "@/lib/dominio";

export const metadata = { title: "Inteligência territorial" };

const ORDEM: Severidade[] = ["impede", "condiciona", "atencao", "sem_dado", "ok"];

export default function Inteligencia() {
  const projetos = listarProjetos();
  const dossies = listarDossies();
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6">
      <Cabecalho
        sobretitulo="Inteligência territorial"
        titulo="O que o território diz antes do processo começar"
        descricao="Para uma área qualquer, o sistema cruza camadas públicas e devolve um dossiê: o que impede, o que condiciona e o que só pede atenção, cada achado com fonte e base legal. Aqui os achados são simulados sobre os núcleos de demonstração; o desenho livre de áreas e a consulta às fontes reais vêm a seguir."
      />

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {dossies.map((d) => {
            const p = projetos.find((x) => x.id === d.projetoId)!;
            const contagem = (s: Severidade) => d.achados.filter((a) => a.severidade === s).length;
            const achados = [...d.achados].sort((a, b) => ORDEM.indexOf(a.severidade) - ORDEM.indexOf(b.severidade));
            return (
              <section key={d.projetoId} className="painel">
                <header className="!items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[20px]">{p.nome}</h2>
                      <Carimbo tom={p.modalidade === "reurb_s" ? "terra" : "registro"}>{MODALIDADE[p.modalidade]}</Carimbo>
                    </div>
                    <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-tinta-700">{d.resumo}</p>
                  </div>
                  <div className="text-right">
                    <Rotulo>Aptidão</Rotulo>
                    <p className={clsx("serif tab text-[34px] leading-none", d.pontuacao >= 70 ? "text-oliva-700" : d.pontuacao >= 45 ? "text-ocre-700" : "text-carimbo-600")}>{d.pontuacao}</p>
                    <p className="text-[11px] text-tinta-500">de 100 · simulado</p>
                  </div>
                </header>
                <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
                  <div className="border-b fio p-3 lg:border-r lg:border-b-0">
                    <MapaNucleo {...camadasBase(p)} lotes={lotesParaMapa(p)} baseInicial="claro" className="h-56" />
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {ORDEM.map((s) => (
                        <li key={s} className={clsx("carimbo", `text-${SEVERIDADE[s].tom === "neutro" ? "tinta-500" : SEVERIDADE[s].tom + (SEVERIDADE[s].tom === "oliva" || SEVERIDADE[s].tom === "ocre" || SEVERIDADE[s].tom === "registro" ? "-700" : "-600")}`)}>
                          {SEVERIDADE[s].rotulo} <span className="tab">{contagem(s)}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href={`/projetos/${p.id}`} className="mt-3 block text-[12.5px] text-terra-700 hover:underline">Abrir o núcleo →</Link>
                  </div>
                  <ul className="divide-y divide-[color:var(--linha)]">
                    {achados.map((a) => (
                      <li key={a.camada} className="grid gap-x-4 gap-y-1 px-4 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)_110px]">
                        <div>
                          <p className="text-[12.5px] font-medium leading-tight text-tinta-900">{a.camada}</p>
                          <p className="mt-0.5 text-[11px] leading-tight text-tinta-500">{a.fonte}</p>
                        </div>
                        <div className="text-[12.5px]">
                          <p className="text-tinta-900">{a.resultado}</p>
                          {a.implicacao !== "—" && <p className="mt-0.5 text-tinta-700">{a.implicacao}{a.base && <span className="mono ml-1 text-[10.5px] text-tinta-300">{a.base}</span>}</p>}
                        </div>
                        <div className="sm:text-right"><Carimbo tom={SEVERIDADE[a.severidade].tom}>{SEVERIDADE[a.severidade].rotulo}</Carimbo></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>

        <div className="space-y-5">
          <Painel titulo="Camadas consultadas" aside={`${CAMADAS.length}`} corpo="p-0">
            <ol className="divide-y divide-[color:var(--linha)]">
              {CAMADAS.map((c, i) => (
                <li key={c.nome} className="grid grid-cols-[22px_1fr] gap-2 px-4 py-2">
                  <span className="tab text-[11px] text-tinta-300">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="text-[12.5px] leading-tight text-tinta-900">{c.nome}</p>
                    <p className="text-[11px] text-tinta-500">{c.fonte}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Painel>
          <Painel titulo="Como vai funcionar">
            <ol className="space-y-2 text-[13px] leading-relaxed text-tinta-700">
              <li><b className="text-tinta-900">1.</b> Desenhe ou importe um perímetro (ou escolha um núcleo).</li>
              <li><b className="text-tinta-900">2.</b> O servidor cruza o polígono com as camadas no PostGIS e com serviços externos (WFS/APIs).</li>
              <li><b className="text-tinta-900">3.</b> Cada achado recebe severidade, implicação e base legal; o dossiê sai em PDF e alimenta o estudo preliminar (art. 35, III).</li>
            </ol>
          </Painel>
        </div>
      </div>
    </div>
  );
}
