import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="rotulo">404</p>
      <h1 className="mt-2 text-[28px]">Página não encontrada</h1>
      <p className="mt-2 text-[14px] text-tinta-700">O núcleo, lote ou documento solicitado não existe nesta base.</p>
      <Link href="/" className="mt-6 inline-block rounded bg-tinta-900 px-4 py-2 text-[13px] font-medium text-papel-50 hover:bg-tinta-700">
        Voltar à mesa de trabalho
      </Link>
    </div>
  );
}
