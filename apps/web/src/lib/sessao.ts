"use client";

// Sessão no navegador. O token fica em sessionStorage: some ao fechar a aba e não vai em cookie,
// então páginas de terceiros não conseguem usá-lo. Só existe quando a interface está ligada a uma API.
import { useSyncExternalStore } from "react";

export const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
export const TEM_API = API !== "";

export interface UsuarioSessao { id: number; nome: string; email: string; perfil: "administrador" | "editor" | "leitor" }
const CHAVE = "geof.sessao";
const ouvintes = new Set<() => void>();
let memo: { bruto: string | null; valor: { token: string; usuario: UsuarioSessao } | null } = { bruto: null, valor: null };

function ler() {
  const bruto = typeof window === "undefined" ? null : window.sessionStorage.getItem(CHAVE);
  if (bruto !== memo.bruto) {
    try {
      memo = { bruto, valor: bruto ? JSON.parse(bruto) : null };
    } catch {
      memo = { bruto, valor: null };
    }
  }
  return memo.valor;
}
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};
function gravar(v: { token: string; usuario: UsuarioSessao } | null) {
  if (v) window.sessionStorage.setItem(CHAVE, JSON.stringify(v));
  else window.sessionStorage.removeItem(CHAVE);
  ouvintes.forEach((f) => f());
}

export function useSessao() {
  return useSyncExternalStore(assinar, ler, () => null);
}
export const podeEditar = (u?: UsuarioSessao | null) => u?.perfil === "editor" || u?.perfil === "administrador";

export class ErroApi extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

/** Chamada à API com o token da sessão. Lança ErroApi com a mensagem do servidor. */
export async function api<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown; formulario?: FormData } = {}): Promise<T> {
  const sessao = ler();
  let resposta: Response;
  try {
    resposta = await fetch(API + caminho, {
      method: opcoes.metodo ?? (opcoes.corpo || opcoes.formulario ? "POST" : "GET"),
      headers: { ...(sessao ? { Authorization: `Bearer ${sessao.token}` } : {}), ...(opcoes.corpo ? { "Content-Type": "application/json" } : {}) },
      body: opcoes.formulario ?? (opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined),
    });
  } catch {
    throw new ErroApi(0, "Não foi possível falar com o servidor. Confira a conexão e tente de novo.");
  }
  if (resposta.status === 401 && sessao) gravar(null);
  if (!resposta.ok) {
    const detalhe = await resposta.json().then((j) => j.detail, () => null);
    throw new ErroApi(resposta.status, typeof detalhe === "string" ? detalhe : resposta.status === 422 ? "Confira os campos preenchidos." : `O servidor recusou a operação (${resposta.status}).`);
  }
  return resposta.status === 204 ? (undefined as T) : resposta.json();
}

export async function entrar(email: string, senha: string) {
  const r = await api<{ token: string; usuario: UsuarioSessao }>("/auth/entrar", { corpo: { email, senha } });
  gravar({ token: r.token, usuario: r.usuario });
  return r.usuario;
}
export async function sair() {
  await api("/auth/sair", { metodo: "POST" }).catch(() => undefined);
  gravar(null);
}
