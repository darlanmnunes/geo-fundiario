import Link from "next/link";
import "./globals.css";
import { classeBotao } from "@/components/ui";

export default function NaoEncontrado() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20 text-center font-sans text-[14px]">
      <h1 className="text-[22px] font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-[14px] text-texto-2">O núcleo, a unidade ou o documento pedido não existe nesta base. Confira o endereço ou use a busca no alto da página.</p>
      <Link href="/painel" className={classeBotao("primario", "mt-5")}>Voltar à visão geral</Link>
    </div>
  );
}
