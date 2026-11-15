"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Aviso, Etiqueta, classeBotao } from "./ui";
import { fmt, SITUACAO_LOTE, SITUACOES } from "@/lib/dominio";
import { api, podeEditar, TEM_API, useSessao } from "@/lib/sessao";

interface Estado {
  situacao: string | null;
  pendencias: { id: number; origem: string; descricao: string; base_legal: string | null; aberta_em: string; resolvida_em: string | null; resolucao: string | null }[];
  historico: { ocorrido_em: string; usuario: string; tabela: string; operacao: string }[];
}
const ORIGENS = { documental: "Documental", ambiental: "Ambiental", juridica: "Jurídica", tecnica: "Técnica", social: "Social" };

/** Correções feitas pelo navegador, gravadas direto no banco e registradas na auditoria. */
export function EdicaoUnidade({ unidadeId }: { unidadeId: number }) {
  const sessao = useSessao();
  const [e, setE] = useState<Estado | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const editor = podeEditar(sessao?.usuario);
  const carregar = useCallback(() => api<Estado>(`/unidades/${unidadeId}`).then(setE, () => setE(null)), [unidadeId]);
  useEffect(() => {
    if (TEM_API && sessao) void carregar();
  }, [sessao, carregar]);

  if (!TEM_API) return <Aviso tom="neutro">Demonstração somente de leitura. Na instalação com login, aqui se muda a situação da unidade, abrem-se e resolvem-se pendências, e cada alteração fica registrada com autor e data. <Link href="/ajuda#entrada" className="font-semibold text-azul underline">Como os dados entram no sistema</Link></Aviso>;
  if (!sessao) return <Aviso tom="azul">Para corrigir dados desta unidade, <Link href="/entrar" className="font-semibold underline">entre no sistema</Link>.</Aviso>;
  if (!e) return <p className="text-[13.5px] text-texto-3" aria-busy="true">Lendo a situação atual no banco.</p>;

  const fazer = async (f: () => Promise<Estado>, ok: string) => {
    try {
      setE(await f());
      setMsg({ ok: true, texto: ok });
    } catch (x) {
      setMsg({ ok: false, texto: x instanceof Error ? x.message : "A gravação falhou." });
    }
  };
  const campo = "h-8 rounded border border-borda-forte bg-superficie px-2 text-[13.5px]";
  const abertas = e.pendencias.filter((p) => !p.resolvida_em);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <h3 className="text-[13.5px] font-semibold">Situação no processo</h3>
        <form className="mt-1.5 flex flex-wrap items-center gap-2" onSubmit={(ev) => { ev.preventDefault(); const d = new FormData(ev.currentTarget); void fazer(() => api(`/unidades/${unidadeId}/situacao`, { metodo: "PUT", corpo: { situacao: d.get("situacao"), observacao: d.get("observacao") || null } }), "Situação gravada."); }}>
          <select name="situacao" defaultValue={e.situacao ?? "levantado"} key={e.situacao} disabled={!editor} aria-label="Situação" className={campo}>
            {SITUACOES.map((s) => <option key={s} value={s}>{SITUACAO_LOTE[s].rotulo}</option>)}
          </select>
          <input name="observacao" placeholder="Observação (opcional)" disabled={!editor} className={`${campo} min-w-40 flex-1`} />
          <button type="submit" disabled={!editor} className={classeBotao("primario")}>Gravar</button>
        </form>

        <h3 className="mt-4 text-[13.5px] font-semibold">Pendências em aberto ({abertas.length})</h3>
        <ul className="mt-1.5 space-y-2">
          {abertas.map((p) => (
            <li key={p.id} className="rounded border border-borda p-2.5 text-[13.5px]">
              <p><Etiqueta tom="ambar">{ORIGENS[p.origem as keyof typeof ORIGENS]}</Etiqueta> <span className="text-texto">{p.descricao}</span></p>
              {editor && (
                <form className="mt-1.5 flex gap-2" onSubmit={(ev) => { ev.preventDefault(); const d = new FormData(ev.currentTarget); void fazer(() => api(`/pendencias/${p.id}/resolver`, { corpo: { resolucao: d.get("resolucao") } }), "Pendência resolvida."); }}>
                  <input name="resolucao" required minLength={3} placeholder="Como foi resolvida" aria-label="Como foi resolvida" className={`${campo} min-w-0 flex-1`} />
                  <button type="submit" className={classeBotao("secundario")}>Resolver</button>
                </form>
              )}
            </li>
          ))}
          {!abertas.length && <li className="text-[13.5px] text-texto-2">Nenhuma.</li>}
        </ul>
        {editor && (
          <form className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto]" onSubmit={(ev) => { ev.preventDefault(); const form = ev.currentTarget; const d = new FormData(form); void fazer(() => api<Estado>(`/unidades/${unidadeId}/pendencias`, { corpo: { origem: d.get("origem"), descricao: d.get("descricao") } }).then((r) => { form.reset(); return r; }), "Pendência aberta."); }}>
            <select name="origem" aria-label="Origem da pendência" className={campo}>{Object.entries(ORIGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input name="descricao" required minLength={5} placeholder="Nova pendência: o que falta" aria-label="Descrição da nova pendência" className={campo} />
            <button type="submit" className={classeBotao("secundario")}>Abrir pendência</button>
          </form>
        )}
        {!editor && <p className="mt-2 text-[13px] text-texto-3">Seu perfil é de leitura. Peça ao administrador o perfil de editor para alterar.</p>}
        {msg && <p role="status" className={`mt-2 text-[13.5px] ${msg.ok ? "text-verde" : "text-vermelho"}`}>{msg.texto}</p>}
      </div>
      <div>
        <h3 className="text-[13.5px] font-semibold">Últimas alterações (auditoria)</h3>
        <ul className="mt-1.5 divide-y divide-borda rounded border border-borda text-[13px]">
          {e.historico.map((h, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-x-3 px-2.5 py-1.5">
              <span>{h.tabela.endsWith("pendencia") ? "Pendência" : "Situação"}: {h.operacao === "INSERT" ? "inclusão" : "alteração"}</span>
              <span className="text-texto-3">{h.usuario}, {fmt.data(h.ocorrido_em)}</span>
            </li>
          ))}
          {!e.historico.length && <li className="px-2.5 py-2 text-texto-2">Sem alterações registradas.</li>}
        </ul>
      </div>
    </div>
  );
}
