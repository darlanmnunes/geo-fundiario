"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { Aviso, classeBotao } from "./ui";
import { entrar, sair, TEM_API, trocarSenha, useSessao } from "@/lib/sessao";

const PERFIL = { administrador: "Administrador", editor: "Editor", leitor: "Leitor" };

function MinhaConta({ nome, email, perfil }: { nome: string; email: string; perfil: keyof typeof PERFIL }) {
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const campo = "mt-1 h-9 w-full rounded border border-borda-forte bg-superficie px-3 text-[14px]";
  const trocar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setErro(null);
    setOk(false);
    if (d.get("nova") !== d.get("repete")) return setErro("A confirmação não é igual à senha nova.");
    try {
      await trocarSenha(String(d.get("atual")), String(d.get("nova")));
      form.reset();
      setOk(true);
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não foi possível trocar a senha.");
    }
  };
  return (
    <div className="w-full max-w-md space-y-4">
      <div className="painel p-6">
        <h1 className="text-[20px] font-semibold">Minha conta</h1>
        <p className="mt-2 text-[14px] text-texto-2">{nome} ({email}), perfil {PERFIL[perfil].toLowerCase()}.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/" className={classeBotao("primario")}>Ir para a visão geral</Link>
          {perfil === "administrador" && <Link href="/admin/usuarios" className={classeBotao("secundario")}>Gerenciar usuários</Link>}
          <button type="button" onClick={() => sair()} className={classeBotao("secundario")}><LogOut className="size-4" aria-hidden /> Sair</button>
        </div>
      </div>
      <form onSubmit={trocar} className="painel p-6">
        <h2 className="text-[16px] font-semibold">Trocar a senha</h2>
        <label className="mt-3 block text-[13.5px] font-semibold">Senha atual<input name="atual" type="password" required autoComplete="current-password" className={campo} /></label>
        <label className="mt-3 block text-[13.5px] font-semibold">Senha nova<input name="nova" type="password" required minLength={10} autoComplete="new-password" className={campo} /></label>
        <label className="mt-3 block text-[13.5px] font-semibold">Repita a senha nova<input name="repete" type="password" required minLength={10} autoComplete="new-password" className={campo} /></label>
        <p className="mt-1 text-[12.5px] text-texto-3">Mínimo de 10 caracteres, com letras e números. As suas outras sessões abertas são encerradas.</p>
        <div aria-live="polite">
          {erro && <p role="alert" className="mt-3 text-[13.5px] text-vermelho">{erro}</p>}
          {ok && <p className="mt-3 text-[13.5px] text-verde">Senha trocada.</p>}
        </div>
        <button type="submit" className={classeBotao("primario", "mt-4")}>Trocar a senha</button>
      </form>
    </div>
  );
}

export function FormularioEntrada() {
  const router = useRouter();
  const sessao = useSessao();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (sessao) return <MinhaConta nome={sessao.usuario.nome} email={sessao.usuario.email} perfil={sessao.usuario.perfil} />;

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
