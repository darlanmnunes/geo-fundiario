// Geração de arquivos no navegador: memorial em DOCX e PDF de demonstração dos documentos.

export function baixarBlob(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Memorial descritivo em DOCX, no formato do modelo: título, quadro do imóvel, descrição justificada e fecho. */
export async function memorialDocx(texto: string): Promise<Blob> {
  const { AlignmentType, Document, Packer, Paragraph, TextRun } = await import("docx");
  const fonte = "Arial";
  const run = (t: string, bold = false, size = 22) => new TextRun({ text: t, bold, size, font: fonte });
  const filhos: InstanceType<typeof Paragraph>[] = [];
  for (const bloco of texto.split("\n\n")) {
    if (bloco === "MEMORIAL DESCRITIVO") {
      filhos.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 480 }, children: [run(bloco, true, 28)] }));
    } else if (bloco === "DESCRIÇÃO DO PERÍMETRO" || bloco === "INFORMAÇÕES ADICIONAIS") {
      filhos.push(new Paragraph({ spacing: { before: 360, after: 200 }, children: [run(bloco, true)] }));
    } else if (bloco.startsWith("IMÓVEL:")) {
      for (const linha of bloco.split("\n")) {
        const [rotulo, ...resto] = linha.split(": ");
        filhos.push(new Paragraph({ spacing: { after: 40 }, children: [run(`${rotulo}: `, true), run(resto.join(": "))] }));
      }
    } else if (bloco.startsWith("Inicia-se")) {
      filhos.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 720 }, spacing: { line: 360 }, children: [run(bloco)] }));
    } else {
      const linhas = bloco.split("\n");
      const assinatura = linhas.some((l) => l.startsWith("____"));
      linhas.forEach((l, i) =>
        filhos.push(new Paragraph({
          alignment: assinatura ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
          spacing: { before: i === 0 ? (assinatura ? 480 : 200) : 0, after: 40 },
          children: [run(l)],
        })),
      );
    }
  }
  const doc = new Document({
    creator: "Geo-Fundiário",
    title: "Memorial descritivo",
    sections: [{ properties: { page: { margin: { top: 1701, bottom: 1134, left: 1701, right: 1134 } } }, children: filhos }], // 3 cm / 2 cm
  });
  return Packer.toBlob(doc);
}

/** PDF mínimo, de uma página, para mostrar como um documento juntado aparece. Não é o documento. */
export function pdfDemonstracao(titulo: string, linhas: string[]): Blob {
  const esc = (t: string) =>
    [...t].map((c) => {
      const n = c.charCodeAt(0);
      if (c === "(" || c === ")" || c === "\\") return `\\${c}`;
      return n < 128 ? c : n < 256 ? `\\${n.toString(8).padStart(3, "0")}` : "?";
    }).join("");
  const conteudo = [
    "0.92 0.94 0.96 rg 0 0 595 842 re f", "1 1 1 rg 40 40 515 762 re f", "0.75 0.78 0.82 RG 40 40 515 762 re S",
    "0.04 0.18 0.40 rg 40 742 515 60 re f",
    `BT /F2 15 Tf 1 1 1 rg 56 766 Td (${esc(titulo.slice(0, 60))}) Tj ET`,
    ...linhas.map((l, i) => `BT /F1 11 Tf 0.1 0.14 0.19 rg 56 ${706 - i * 20} Td (${esc(l.slice(0, 92))}) Tj ET`),
    "BT /F2 30 Tf 0.86 0.88 0.91 rg 1 0 0 1 0 0 Tm 0.7 0.7 -0.7 0.7 150 250 Tm (DEMONSTRACAO) Tj ET",
  ].join("\n");
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const pos: number[] = [];
  objetos.forEach((o, i) => {
    pos.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${pos.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([Uint8Array.from(pdf, (c) => c.charCodeAt(0) & 0xff)], { type: "application/pdf" });
}
