"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronDown, CircleHelp, KeyRound, LogIn, LogOut, Search, Sparkles, UserRound, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sair, useSessao } from "@/lib/sessao";

interface Props {
  projetos: { id: number; nome: string }[];
}

function Marca() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Geo-Fundiário, página inicial">
      {/* Um lote em planta com um vértice marcado */}
      {/* Um lote em planta, com a diagonal de conferência e o vértice de partida marcado */}
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <path d="M4 7.5 L19 4 L22 19.5 L7 22 Z" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M4 7.5 L22 19.5" stroke="#fff" strokeWidth="0.9" strokeDasharray="1.5 2.2" />
        <circle cx="19" cy="4" r="2.5" fill="#ffd23d" />
      </svg>
      <span className="text-[17px] leading-none font-bold whitespace-nowrap text-white">Geo-Fundiário</span>
    </Link>
  );
}

const PERFIL = { administrador: "Administrador", editor: "Editor", leitor: "Leitor" };

function MenuConta({ nome, email, perfil }: { nome: string; email: string; perfil: keyof typeof PERFIL }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);
  const linha = "flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px] text-texto hover:bg-realce";
  return (
    <div ref={caixa} className="relative shrink-0">
      <button type="button" aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((v) => !v)} className="flex h-8 items-center gap-1.5 rounded border border-white/25 px-2.5 text-[13px] text-white hover:bg-white/10">
        <UserRound className="size-4" aria-hidden />
        <span className="hidden max-w-28 truncate sm:inline">{nome.split(" ")[0]}</span>
        <ChevronDown className="size-3.5 opacity-80" aria-hidden />
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-10 z-50 w-64 overflow-hidden rounded border border-borda bg-superficie shadow-[0_6px_20px_rgb(27_36_48/0.22)]">
          <div className="border-b border-borda px-3 py-2.5">
            <p className="truncate text-[14px] font-semibold text-texto">{nome}</p>
            <p className="truncate text-[12.5px] text-texto-3">{email}</p>
            <p className="mt-0.5 text-[12.5px] text-texto-2">Perfil: {PERFIL[perfil]}</p>
          </div>
          {perfil === "administrador" && <Link role="menuitem" href="/admin/usuarios" onClick={() => setAberto(false)} className={linha}><Users className="size-4 text-texto-3" aria-hidden /> Usuários</Link>}
          <Link role="menuitem" href="/entrar" onClick={() => setAberto(false)} className={linha}><KeyRound className="size-4 text-texto-3" aria-hidden /> Minha conta e senha</Link>
          <button role="menuitem" type="button" onClick={async () => { setAberto(false); await sair(); router.push("/"); }} className={clsx(linha, "border-t border-borda")}><LogOut className="size-4 text-texto-3" aria-hidden /> Sair</button>
        </div>
      )}
    </div>
  );
}

export function BarraSuperior({ projetos }: Props) {
  const caminho = usePathname();
  const sessao = useSessao();
  const emNucleo = caminho.startsWith("/projetos/");
  const abrirBusca = () => window.dispatchEvent(new CustomEvent("geof:paleta"));

  const item = (href: string, ativo: boolean, texto: string) => (
    <Link
      key={href}
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={clsx(
        "flex h-12 items-center border-b-[3px] px-3 text-[14px] whitespace-nowrap transition-colors",
        ativo ? "border-[#ffd23d] font-semibold text-white" : "border-transparent text-white/80 hover:bg-white/10 hover:text-white",
      )}
    >
      {texto}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 bg-marinho text-white">
      <div className="mx-auto flex h-12 w-full max-w-[1680px] items-center gap-3 px-4 sm:px-6">
        <Marca />
        <nav aria-label="Principal" className="ml-3 flex min-w-0 flex-1 items-center overflow-x-auto">
          {item("/", caminho === "/", "Visão geral")}
          <div className="group relative">
            <button type="button" aria-haspopup="true" className={clsx("flex h-12 items-center border-b-[3px] px-3 text-[14px] whitespace-nowrap", emNucleo ? "border-[#ffd23d] font-semibold text-white" : "border-transparent text-white/80 hover:bg-white/10 hover:text-white")}>
              Núcleos
            </button>
            <ul className="invisible fixed z-40 mt-0 min-w-60 rounded-b border border-t-0 border-borda-forte bg-superficie py-1 text-texto opacity-0 shadow-[0_6px_16px_rgb(27_36_48/0.2)] transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              {projetos.map((p) => (
                <li key={p.id}>
                  <Link href={`/projetos/${p.id}`} className={clsx("block px-3.5 py-1.5 text-[14px] hover:bg-azul-claro", caminho.startsWith(`/projetos/${p.id}`) && "font-semibold text-azul")}>{p.nome}</Link>
                </li>
              ))}
            </ul>
          </div>
          {item("/inteligencia", caminho.startsWith("/inteligencia"), "Inteligência territorial")}
          {item("/legislacao", caminho.startsWith("/legislacao"), "Base legal")}
        </nav>
        <button
          type="button"
          onClick={abrirBusca}
          className="flex h-8 shrink-0 items-center gap-2 rounded border border-white/25 bg-white/10 px-2.5 text-[13px] text-white/90 hover:bg-white/20"
          aria-label="Buscar lote, pessoa, fase ou documento"
        >
          <Search className="size-4" aria-hidden />
          <span className="hidden lg:inline">Buscar</span>
          <kbd className="hidden border-white/30 bg-transparent text-white/70 lg:inline">Ctrl K</kbd>
        </button>
        <Link href="/assistente" aria-current={caminho.startsWith("/assistente") ? "page" : undefined} className={clsx("flex h-8 shrink-0 items-center gap-1.5 rounded px-2 text-[13px] hover:bg-white/10", caminho.startsWith("/assistente") ? "bg-white/15 text-white" : "text-white/85")}>
          <Sparkles className="size-4" aria-hidden /> <span className="hidden md:inline">Assistente IA</span>
        </Link>
        <Link href="/ajuda" aria-current={caminho.startsWith("/ajuda") ? "page" : undefined} className={clsx("flex h-8 shrink-0 items-center gap-1.5 rounded px-2 text-[13px] hover:bg-white/10", caminho.startsWith("/ajuda") ? "bg-white/15 text-white" : "text-white/85")}>
          <CircleHelp className="size-4" aria-hidden /> <span className="hidden md:inline">Ajuda</span>
        </Link>
        {sessao ? <MenuConta nome={sessao.usuario.nome} email={sessao.usuario.email} perfil={sessao.usuario.perfil} /> : (
          <Link href="/entrar" className="flex h-8 shrink-0 items-center gap-1.5 rounded border border-white/25 px-2.5 text-[13px] text-white hover:bg-white/10" title="Entrar para inserir e corrigir dados">
            <LogIn className="size-4" aria-hidden /> <span className="hidden sm:inline">Entrar</span>
          </Link>
        )}
      </div>
    </header>
  );
}
