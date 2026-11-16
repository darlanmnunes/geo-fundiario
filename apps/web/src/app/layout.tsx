import type { Metadata } from "next";

// Layout raiz mínimo: o sistema e a página de apresentação têm folhas de estilo próprias, carregadas
// cada uma no seu grupo de rotas, para que uma não interfira na outra.

// Impede que o site seja exibido dentro de outra página (clickjacking). No servidor Next o bloqueio é por
// cabeçalho (next.config.ts); no site estático, que não envia cabeçalhos próprios, é este trecho.
const DEV = process.env.NODE_ENV === "development";
const ANTI_MOLDURA = "if(self!==top){try{top.location.replace(self.location.href)}catch(e){document.documentElement.style.display='none'}}";

export const metadata: Metadata = {
  title: { default: "Geo-Fundiário", template: "%s - Geo-Fundiário" },
  description: "Plataforma aberta de gestão fundiária e territorial: do levantamento de campo ao registro.",
  referrer: "strict-origin-when-cross-origin",
};

export default function LayoutRaiz({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <head>{!DEV && <script dangerouslySetInnerHTML={{ __html: ANTI_MOLDURA }} />}</head>
      <body>{children}</body>
    </html>
  );
}
