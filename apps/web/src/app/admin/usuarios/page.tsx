import { GestaoUsuarios } from "@/components/gestao-usuarios";
import { Cabecalho, Pagina } from "@/components/ui";

export const metadata = { title: "Usuários" };

export default function Usuarios() {
  return (
    <Pagina>
      <Cabecalho titulo="Usuários" descricao="Quem pode entrar no sistema e o que cada pessoa pode fazer. Só administradores veem esta página." />
      <div className="mt-4"><GestaoUsuarios /></div>
    </Pagina>
  );
}
