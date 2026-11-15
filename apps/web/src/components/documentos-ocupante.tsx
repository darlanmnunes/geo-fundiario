"use client";

import { useRef, useState } from "react";
import { FileImage, FileText, FileWarning, Upload } from "lucide-react";
import { classeBotao } from "./ui";
import type { Arquivo } from "@/lib/dados";
import { pdfDemonstracao } from "@/lib/arquivos";
import { fmt, TIPO_DOCUMENTO } from "@/lib/dominio";
import { api, API, podeEditar, TEM_API, useSessao } from "@/lib/sessao";

/** Documentos juntados de um ocupante, como cartões de arquivo; os obrigatórios que faltam aparecem vazados. */
export function DocumentosOcupante({ arquivos, faltando, ocupante, projetoId, partyRef }: { arquivos: Arquivo[]; faltando: string[]; ocupante: string; projetoId: number; partyRef: { entidade: string; id: number } | null }) {
  const sessao = useSessao();
  const entrada = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState(faltando[0] ?? "outro");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [novos, setNovos] = useState<Arquivo[]>([]);

  const abrir = async (a: Arquivo) => {
    if (TEM_API && sessao) {
      // arquivo real, com a credencial da sessão
      const r = await fetch(`${API}/documentos/${a.id}/arquivo`, { headers: { Authorization: `Bearer ${sessao.token}` } });
      if (r.ok) return void window.open(URL.createObjectURL(await r.blob()), "_blank", "noopener");
    }
    const blob = pdfDemonstracao(TIPO_DOCUMENTO[a.tipo] ?? a.titulo, [
      `Titular: ${ocupante}`, `Arquivo: ${a.nome_arquivo} (${fmt.kb(a.tamanho_kb)})`, `Juntado em: ${fmt.data(a.data)}`, "",
      "Este PDF apenas ilustra como um documento juntado aparece no sistema.", "Na instalação real, aqui abre o arquivo enviado, guardado fora do banco",
      "e endereçado pelo seu resumo SHA-256.",
    ]);
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  };

  const enviar = async (arquivo: File) => {
    if (!partyRef) return;
    const f = new FormData();
    f.set("arquivo", arquivo);
    f.set("tipo", tipo);
    f.set("titulo", `${TIPO_DOCUMENTO[tipo] ?? tipo} - ${ocupante}`);
    f.set("projeto_id", String(projetoId));
    f.set("entidade", partyRef.entidade);
    f.set("entidade_id", String(partyRef.id));
    f.set("papel", "comprovante");
    try {
      const r = await api<{ id: string; codigo_verificacao: string }>("/documentos", { formulario: f });
      setNovos((n) => [...n, { id: r.id, tipo, titulo: arquivo.name, nome_arquivo: arquivo.name, mime: arquivo.type, tamanho_kb: Math.round(arquivo.size / 1024), data: new Date().toISOString(), codigo_verificacao: r.codigo_verificacao }]);
      setMsg({ ok: true, texto: `Documento gravado no banco. Código de verificação: ${r.codigo_verificacao}.` });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof Error ? e.message : "O envio falhou." });
    }
  };

  const todos = [...arquivos, ...novos];
  const aindaFalta = faltando.filter((t) => !novos.some((n) => n.tipo === t));
  return (
    <div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {todos.map((a) => {
          const imagem = a.mime.startsWith("image/");
          return (
            <li key={a.id}>
              <button type="button" onClick={() => abrir(a)} title="Abrir o documento" className="flex w-full items-start gap-2.5 rounded border border-borda bg-superficie p-2.5 text-left hover:border-azul hover:bg-azul-claro/40">
                <span className={`flex h-10 w-8 shrink-0 flex-col items-center justify-center rounded-[3px] text-white ${imagem ? "bg-[#2f7de1]" : "bg-[#c4281c]"}`}>
                  {imagem ? <FileImage className="size-4" aria-hidden /> : <FileText className="size-4" aria-hidden />}
                  <span className="text-[8.5px] leading-none font-bold">{imagem ? "JPG" : "PDF"}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-texto">{TIPO_DOCUMENTO[a.tipo] ?? a.titulo}</span>
                  <span className="block truncate text-[12px] text-texto-3">{a.nome_arquivo}, {fmt.kb(a.tamanho_kb)}</span>
                  <span className="block text-[12px] text-texto-3">Juntado em {fmt.data(a.data)}</span>
                </span>
              </button>
            </li>
          );
        })}
        {aindaFalta.map((t) => (
          <li key={t} className="flex items-start gap-2.5 rounded border border-dashed border-vermelho/60 bg-vermelho-claro/40 p-2.5">
            <FileWarning className="mt-0.5 size-6 shrink-0 text-vermelho" aria-hidden />
            <span><span className="block text-[13.5px] font-semibold text-vermelho">{TIPO_DOCUMENTO[t]}</span><span className="block text-[12px] text-texto-2">Obrigatório, ainda não entregue</span></span>
          </li>
        ))}
      </ul>
      {!todos.length && !aindaFalta.length && <p className="text-[13.5px] text-texto-2">Nenhum documento juntado.</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borda pt-3 text-[13px]">
        {TEM_API && podeEditar(sessao?.usuario) && partyRef ? (
          <>
            <label className="text-texto-2">Tipo <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="ml-1 h-8 rounded border border-borda-forte bg-superficie px-2">
              {["rg", "cpf", "certidao_casamento", "comprovante_renda", "comprovante_residencia", "declaracao_nao_proprietario", "foto_fachada", "outro"].map((t) => <option key={t} value={t}>{TIPO_DOCUMENTO[t]}</option>)}
            </select></label>
            <input ref={entrada} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])} aria-label="Arquivo a anexar" />
            <button type="button" onClick={() => entrada.current?.click()} className={classeBotao("primario")}><Upload className="size-4" aria-hidden /> Anexar documento</button>
            <span className="text-texto-3">PDF, JPG ou PNG de até 25 MB.</span>
          </>
        ) : (
          <span className="text-texto-3">{TEM_API ? "Entre com perfil de editor para anexar documentos." : "Demonstração: os cartões abrem um PDF ilustrativo. Anexar documentos exige a instalação com login."}</span>
        )}
        {msg && <span role="status" className={msg.ok ? "text-verde" : "text-vermelho"}>{msg.texto}</span>}
      </div>
    </div>
  );
}
