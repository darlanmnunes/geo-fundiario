import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { MapaNucleo } from "@/components/mapa-nucleo";
import { CaixaMemorial } from "@/components/caixa-memorial";
import { Carimbo, Carregando, Dado, Painel, Ponto, Rotulo, Tabela } from "@/components/ui";
import { camadasBase, listarProjetos, lotesDe, lotesParaMapa, obterLote, obterProjeto } from "@/lib/dados";
import { erroEsferico, ESCOLARIDADE, fmt, LIMITE_ERRO_ESFERICO_M, SITUACAO_LOTE, SITUACAO_PROFISSIONAL, TIPO_DOCUMENTO } from "@/lib/dominio";

export function generateStaticParams() {
  return listarProjetos().flatMap((p) => lotesDe(p).map((l) => ({ id: String(p.id), codigo: l.codigo })));
}

const METODO: Record<string, string> = { gnss_rtk: "GNSS RTK", estacao_total: "Estação total" };
const DOCS_PESSOA = ["rg", "cpf", "certidao_casamento", "comprovante_renda", "comprovante_residencia", "declaracao_nao_proprietario", "foto_fachada"];

async function Conteudo({ params }: Pick<PageProps<"/projetos/[id]/lotes/[codigo]">, "params">) {
  const { id, codigo } = await params;
  const p = obterProjeto(id)!;
  const l = obterLote(p, codigo);
  if (!l) notFound();
  const sit = SITUACAO_LOTE[l.situacao];
  const o = l.ocupante;
  const criterios = o && p.modalidade === "reurb_s"
    ? [
        { ok: o.renda_sm <= 5, texto: `Renda familiar de até 5 salários mínimos (${fmt.num(o.renda_sm, 1)} SM)`, base: "Dec. 9.310/2018, art. 6º" },
        { ok: !o.possui_outro_imovel, texto: "Não é proprietário exclusivo de outro imóvel urbano ou rural", base: "art. 23, §1º, I" },
        { ok: true, texto: "Não foi contemplado com legitimação anterior (declaração)", base: "art. 23, §1º, II" },
        { ok: o.uso !== "comercial", texto: o.uso === "comercial" ? "Uso não residencial: requer reconhecimento de interesse público" : "Uso residencial ou misto", base: "art. 23, §1º, III" },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/projetos/${p.id}/lotes`} className="flex items-center gap-1 text-[12px] text-tinta-500 hover:text-tinta-900"><ArrowLeft className="size-3.5" /> Cadastro</Link>
          <h2 className="mt-1 text-[26px] leading-none">
            Lote {String(l.numero).padStart(2, "0")} <span className="text-tinta-300">·</span> Quadra {String(l.quadra).padStart(2, "0")}
            <span className="mono ml-3 align-middle text-[13px] text-tinta-500">{l.codigo}</span>
          </h2>
        </div>
        <span className="flex items-center gap-2 text-[13px]"><Ponto cor={sit.cor} /> {sit.rotulo}</span>
      </div>

      {l.pendencias.length > 0 && (
        <div className="rounded border border-ocre-600/40 bg-ocre-100/60 px-4 py-3 text-[13px] text-tinta-900">
          <Rotulo className="text-ocre-700">Pendências</Rotulo>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{l.pendencias.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <MapaNucleo {...camadasBase(p)} lotes={lotesParaMapa(p)} destaque={l.codigo} className="h-80 lg:col-span-3 lg:h-auto lg:min-h-96" />
        <div className="space-y-5 lg:col-span-2">
          <Painel titulo="Imóvel">
            <div className="grid grid-cols-2 gap-3">
              <Dado rotulo="Área (plano UTM)" mono>{fmt.num(l.area_m2)} m²</Dado>
              <Dado rotulo="Perímetro" mono>{fmt.num(l.perimetro_m)} m</Dado>
              <Dado rotulo="Vértices" mono>{l.vertices.length}</Dado>
              <Dado rotulo="Edificado">{l.edificado ? "Sim" : "Não"}</Dado>
            </div>
          </Painel>
          <Painel titulo="Ocupante e cadastro social">
            {o ? (
              <div className="space-y-4 text-[13px]">
                <div>
                  <p className="text-[15px] font-medium">{o.nome}</p>
                  <p className="mono text-[12px] text-tinta-500">CPF {o.cpf_mascarado}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Dado rotulo="Renda familiar" mono>{fmt.moeda(o.renda_familiar)}</Dado>
                  <Dado rotulo="Composição">{o.composicao_familiar} pessoas</Dado>
                  <Dado rotulo="Ocupação">{o.tempo_ocupacao_anos} anos</Dado>
                  <Dado rotulo="Uso" className="capitalize">{o.uso}</Dado>
                  <Dado rotulo="Idade / escolaridade">{o.idade} · {ESCOLARIDADE[o.escolaridade]}</Dado>
                  <Dado rotulo="Situação profissional">{SITUACAO_PROFISSIONAL[o.situacao_profissional]}</Dado>
                </div>
                <div className="border-t fio pt-3">
                  <Rotulo className="mb-1.5">Documentos</Rotulo>
                  <ul className="grid grid-cols-1 gap-1 text-[12.5px]">
                    {DOCS_PESSOA.map((d) => {
                      const tem = o.documentos.includes(d);
                      const exigido = o.documentos_pendentes.includes(d);
                      return (
                        <li key={d} className="flex items-center gap-2">
                          {tem ? <CheckCircle2 className="size-3.5 text-oliva-700" /> : <XCircle className={clsx("size-3.5", exigido ? "text-carimbo-600" : "text-tinta-300")} />}
                          <span className={clsx(!tem && !exigido && "text-tinta-500")}>{TIPO_DOCUMENTO[d]}</span>
                          {exigido && <Carimbo tom="carimbo">exigido</Carimbo>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {criterios.length > 0 && (
                  <div className="border-t fio pt-3">
                    <Rotulo className="mb-1.5">Legitimação fundiária (REURB-S) — art. 23</Rotulo>
                    <ul className="space-y-1.5">
                      {criterios.map((c) => (
                        <li key={c.texto} className="flex gap-2">
                          {c.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-oliva-700" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-carimbo-600" />}
                          <span><span className={clsx(!c.ok && "text-carimbo-600")}>{c.texto}</span> <span className="text-[11px] text-tinta-300">{c.base}</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-tinta-500">Lote sem ocupante identificado. Unidades não ocupadas seguem o art. 54 da Lei 13.465/2017.</p>
            )}
          </Painel>
        </div>
      </div>

      <Painel titulo="Vértices e segmentos — SIRGAS 2000 / UTM 23S" aside={<>limite ≤ {fmt.num(LIMITE_ERRO_ESFERICO_M * 100, 0)} cm por vértice (Dec. 9.310/2018, art. 29, §3º)</>}>
        <Tabela cabecalho={["Vértice", "E (m)", "N (m)", "Método", "Erro esf.", "→ Azimute", "Distância", "Confrontante"]}>
          {l.vertices.map((v, i) => {
            const s = l.segmentos[i];
            const erro = erroEsferico(v.sigma);
            return (
              <tr key={v.codigo}>
                <td className="mono py-2 pr-4 font-medium">{v.codigo}</td>
                <td className="mono py-2 pr-4 text-right">{fmt.num(v.e, 3)}</td>
                <td className="mono py-2 pr-4 text-right">{fmt.num(v.n, 3)}</td>
                <td className="py-2 pr-4 text-tinta-700">{METODO[v.metodo] ?? v.metodo}</td>
                <td className={clsx("mono py-2 pr-4 text-right", erro > LIMITE_ERRO_ESFERICO_M ? "font-medium text-carimbo-600" : "text-oliva-700")}>{fmt.num(erro * 100, 1)} cm</td>
                <td className="mono py-2 pr-4">{fmt.gms(s.azimute)}</td>
                <td className="mono py-2 pr-4 text-right">{fmt.num(s.distancia)} m</td>
                <td className="py-2 text-tinta-700">{s.confrontante}</td>
              </tr>
            );
          })}
        </Tabela>
      </Painel>

      <Painel titulo="Memorial descritivo" aside="gerado dos vértices medidos">
        <CaixaMemorial texto={l.memorial} arquivo={`memorial-${p.id}-${l.codigo}.txt`} />
      </Painel>
    </div>
  );
}

export default function FichaLote({ params }: PageProps<"/projetos/[id]/lotes/[codigo]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}
