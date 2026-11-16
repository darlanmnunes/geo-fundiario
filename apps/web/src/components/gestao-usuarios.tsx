"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Aviso, Etiqueta, Painel, Tabela, classeBotao } from "./ui";
import { fmt } from "@/lib/dominio";
import { api, TEM_API, useSessao } from "@/lib/sessao";

interface Linha { id: number; nome: string; email: string; perfil: "administrador" | "editor" | "leitor"; ativo: boolean; ultimo_acesso: string | null; criado_por: string | null }
const PERFIS = [
  ["leitor", "Leitor", "Consulta tudo, inclusive dados pessoais. Não altera nada."],
  ["editor", "Editor", "Insere e corrige unidades, pendências, cadastro social e documentos."],
  ["administrador", "Administrador", "Tudo o que o editor faz e gerencia os usuários."],
] as const;

export function GestaoUsuarios() {
  const sessao = useSessao();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const admin = sessao?.usuario.perfil === "administrador";
  const [redefinindo, setRedefinindo] = useState<number | null>(null);

  const carregar = useCallback(() => api<Linha[]>("/usuarios").then(setLinhas, (e) => setErro(e.message)), []);
  useEffect(() => {
    if (admin) void carregar();
  }, [admin, carregar]);

  if (!TEM_API) return <Aviso tom="azul">A demonstração pública é somente de leitura. A gestão de usuários funciona na instalação com a API ligada.</Aviso>;
  if (!admin) return <Aviso tom="ambar">Esta página é restrita a administradores. <Link href="/entrar" className="font-semibold underline">Entrar</Link></Aviso>;

  const acao = async (f: () => Promise<unknown>, ok: string) => {
    setErro(null);
    setAviso(null);
    try {
      await f();
      setAviso(ok);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falhou.");
    }
  };
  const criar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form));
    void acao(() => api("/usuarios", { corpo: d }).then(() => form.reset()), `Usuário ${d.email} criado. Passe a senha inicial por um canal seguro e peça a troca em Minha conta.`);
  };
  const campo = "mt-1 h-9 w-full rounded border border-borda-forte bg-superficie px-2.5 text-[14px]";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Painel titulo="Contas" aside={linhas ? `${linhas.length} usuários` : "carregando"} corpo="p-0">
        <div aria-live="polite">
          {erro && <p role="alert" className="border-b border-borda bg-vermelho-claro px-3.5 py-2 text-[13.5px] text-vermelho">{erro}</p>}
          {aviso && <p className="border-b border-borda bg-verde-claro px-3.5 py-2 text-[13.5px] text-verde">{aviso}</p>}
        </div>
        <Tabela cabecalho={["Nome", "E-mail", "Perfil", "Situação", "Último acesso", ""]}>
          {(linhas ?? []).map((u) => (
            <Fragment key={u.id}>
            <tr className="hover:bg-realce">
              <td className="px-3 py-2 font-semibold">{u.nome}</td>
              <td className="px-3 py-2 text-texto-2">{u.email}</td>
              <td className="px-3 py-2">
                <select aria-label={`Perfil de ${u.nome}`} value={u.perfil} onChange={(e) => acao(() => api(`/usuarios/${u.id}`, { metodo: "PATCH", corpo: { perfil: e.target.value } }), "Perfil alterado.")} className="h-7 rounded border border-borda-forte bg-superficie px-1.5 text-[13px]">
                  {PERFIS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
              </td>
              <td className="px-3 py-2"><Etiqueta tom={u.ativo ? "verde" : "neutro"}>{u.ativo ? "Ativo" : "Bloqueado"}</Etiqueta></td>
              <td className="px-3 py-2 text-texto-2">{u.ultimo_acesso ? fmt.data(u.ultimo_acesso) : "nunca entrou"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                <button type="button" aria-expanded={redefinindo === u.id} onClick={() => setRedefinindo(redefinindo === u.id ? null : u.id)} className={classeBotao("secundario", "mr-1.5 h-7 px-2.5")}>Redefinir senha</button>
                <button type="button" onClick={() => acao(() => api(`/usuarios/${u.id}`, { metodo: "PATCH", corpo: { ativo: !u.ativo } }), u.ativo ? "Acesso bloqueado; as sessões abertas foram encerradas." : "Acesso liberado.")} className={classeBotao("secundario", "h-7 px-2.5")}>
                  {u.ativo ? "Bloquear" : "Liberar"}
                </button>
              </td>
            </tr>
            {redefinindo === u.id && (
              <tr className="bg-realce">
                <td colSpan={6} className="px-3 py-3">
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const senha = String(new FormData(e.currentTarget).get("senha"));
                      void acao(() => api(`/usuarios/${u.id}`, { metodo: "PATCH", corpo: { senha } }).then(() => setRedefinindo(null)), `Senha de ${u.nome} redefinida; as sessões abertas dessa conta foram encerradas. Passe a senha nova por um canal seguro e peça a troca em Minha conta.`);
                    }}
                  >
                    <label className="text-[13px] font-semibold">Senha nova de {u.nome.split(" ")[0]}
                      <input name="senha" type="password" required minLength={10} autoComplete="new-password" className="mt-1 block h-8 w-64 rounded border border-borda-forte bg-superficie px-2.5 text-[14px]" />
                    </label>
                    <button type="submit" className={classeBotao("primario", "h-8")}>Gravar</button>
                    <button type="button" onClick={() => setRedefinindo(null)} className={classeBotao("secundario", "h-8")}>Cancelar</button>
                    <span className="basis-full text-[12.5px] text-texto-3">Mínimo de 10 caracteres, com letras e números.</span>
                  </form>
                </td>
              </tr>
            )}
            </Fragment>
          ))}
        </Tabela>
      </Painel>

      <div className="space-y-4">
        <Painel titulo="Novo usuário">
          <form onSubmit={criar}>
            <label className="block text-[13.5px] font-semibold">Nome completo<input name="nome" required minLength={3} className={campo} /></label>
            <label className="mt-3 block text-[13.5px] font-semibold">E-mail<input name="email" type="email" required className={campo} /></label>
            <label className="mt-3 block text-[13.5px] font-semibold">Senha inicial<input name="senha" type="password" required minLength={10} autoComplete="new-password" className={campo} /></label>
            <p className="mt-1 text-[12.5px] text-texto-3">Mínimo de 10 caracteres, com letras e números.</p>
            <label className="mt-3 block text-[13.5px] font-semibold">Perfil
              <select name="perfil" defaultValue="editor" className={campo}>{PERFIS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
            </label>
            <button type="submit" className={classeBotao("primario", "mt-4")}><UserPlus className="size-4" aria-hidden /> Criar usuário</button>
          </form>
        </Painel>
        <Painel titulo="O que cada perfil pode fazer">
          <dl className="space-y-2 text-[13.5px]">
            {PERFIS.map(([v, r, d]) => <div key={v}><dt className="font-semibold">{r}</dt><dd className="text-texto-2">{d}</dd></div>)}
          </dl>
          <p className="mt-3 border-t border-borda pt-3 text-[13px] text-texto-3">Toda alteração fica registrada na auditoria com o e-mail de quem fez, a data e o valor anterior.</p>
        </Painel>
      </div>
    </div>
  );
}
