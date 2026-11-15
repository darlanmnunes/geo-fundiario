"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Aviso, classeBotao } from "./ui";
import { entrar, sair, TEM_API, useSessao } from "@/lib/sessao";

const PERFIL = { administrador: "Administrador", editor: "Editor", leitor: "Leitor" };

export function FormularioEntrada() {
  const router = useRouter();
  const sessao = useSessao();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (sessao) {
    return (
      <div className="painel w-full max-w-md p-6">
        <h1 className="text-[20px] font-semibold">Você está no sistema</h1>
        <p className="mt-2 text-[14px] text-texto-2">{sessao.usuario.nome} ({sessao.usuario.email}), perfil {PERFIL[sessao.usuario.perfil].toLowerCase()}.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/" className={classeBotao("primario")}>Ir para a visão geral</Link>
          {sessao.usuario.perfil === "administrador" && <Link href="/admin/usuarios" className={classeBotao("secundario")}>Gerenciar usuários</Link>}
          <button type="button" onClick={() => sair()} className={classeBotao("secundario")}>Sair</button>
        </div>
      </div>
    );
  }

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    setEnviando(true);
    setErro(null);
    try {
      await entrar(String(dados.get("email")), String(dados.get("senha")));
      router.push("/");
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={enviar} className="painel p-6">
        <h1 className="text-[20px] font-semibold">Entrar no Geo-Fundiário</h1>
        <p className="mt-1 text-[14px] text-texto-2">Para inserir e corrigir dados e documentos. A consulta continua aberta sem login.</p>
        <label className="mt-4 block text-[13.5px] font-semibold" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="username" disabled={!TEM_API} className="mt-1 h-9 w-full rounded border border-borda-forte bg-superficie px-3 text-[14px] disabled:bg-realce" />
        <label className="mt-3 block text-[13.5px] font-semibold" htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" required autoComplete="current-password" disabled={!TEM_API} className="mt-1 h-9 w-full rounded border border-borda-forte bg-superficie px-3 text-[14px] disabled:bg-realce" />
        {erro && <p role="alert" className="mt-3 text-[13.5px] text-vermelho">{erro}</p>}
        <button type="submit" disabled={!TEM_API || enviando} className={classeBotao("primario", "mt-4 h-9 w-full justify-center")}>
          <LogIn className="size-4" aria-hidden /> {enviando ? "Entrando" : "Entrar"}
        </button>
        <p className="mt-3 text-[13px] text-texto-3">Não tem acesso? As contas são criadas pelo administrador do sistema no seu município.</p>
      </form>
      {!TEM_API && (
        <Aviso tom="azul" className="mt-3">
          Esta é a demonstração pública, somente de leitura: não há servidor para receber alterações. O login funciona na instalação com a API ligada. Veja como em <Link href="/ajuda#entrada" className="font-semibold underline">Ajuda</Link>.
        </Aviso>
      )}
    </div>
  );
}
