import { FormularioEntrada } from "@/components/formulario-entrada";
import { Pagina } from "@/components/ui";

export const metadata = { title: "Entrar" };

export default function Entrar() {
  return (
    <Pagina className="flex justify-center py-10">
      <FormularioEntrada />
    </Pagina>
  );
}
