import clsx from "clsx";

export interface ItemGrafico { chave: string; rotulo: string; valor: number; cor?: string }

/**
 * Barras horizontais com rótulo e valor em linha. Clicáveis quando `aoClicar` é dado (filtro cruzado).
 * Eixo sempre a partir do zero; o valor vai escrito, então não há grade.
 */
export function BarrasH({ itens, aoClicar, ativos, corPadrao = "#1351b4", larguraRotulo = "8.5rem", unidade }: {
  itens: ItemGrafico[]; aoClicar?: (chave: string) => void; ativos?: Set<string>; corPadrao?: string; larguraRotulo?: string; unidade?: string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return (
    <ul className="space-y-1">
      {itens.map((i) => {
        const apagado = ativos && !ativos.has(i.chave);
        const linha = (
          <>
            <span className="truncate text-left text-[13px] text-texto-2" style={{ width: larguraRotulo }}>{i.rotulo}</span>
            <span className="h-4 flex-1">
              <span className="block h-full rounded-[2px] transition-[width] duration-200" style={{ width: `${(i.valor / max) * 100}%`, minWidth: i.valor ? 2 : 0, background: i.cor ?? corPadrao }} />
            </span>
            <span className="num w-8 text-right text-[13px] font-semibold text-texto">{i.valor}</span>
            <span className="num w-9 text-right text-[12px] text-texto-3">{total ? Math.round((i.valor / total) * 100) : 0}%</span>
          </>
        );
        return (
          <li key={i.chave}>
            {aoClicar ? (
              <button type="button" onClick={() => aoClicar(i.chave)} aria-pressed={ativos ? ativos.has(i.chave) : undefined}
                title={`${i.rotulo}: ${i.valor}${unidade ? ` ${unidade}` : ""}. Clique para filtrar.`}
                className={clsx("flex w-full items-center gap-2 rounded px-1 py-0.5 hover:bg-realce", apagado && "opacity-40")}>
                {linha}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-1 py-0.5" title={`${i.rotulo}: ${i.valor}${unidade ? ` ${unidade}` : ""}`}>{linha}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Colunas verticais para categorias ordenadas (faixas). Valor escrito sobre cada coluna. */
export function Colunas({ itens, cor = "#1351b4", destaque, altura = 120 }: { itens: ItemGrafico[]; cor?: string; destaque?: { chave: string; cor: string }; altura?: number }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ol className="flex items-end gap-1.5" role="list">
      {itens.map((i) => (
        <li key={i.chave} className="flex min-w-0 flex-1 flex-col items-center" title={`${i.rotulo}: ${i.valor}`}>
          <span className="num text-[12.5px] font-semibold text-texto">{i.valor}</span>
          <span className="mt-0.5 flex w-full items-end" style={{ height: altura }}>
            <span className="block w-full rounded-t-[2px] transition-[height] duration-200" style={{ height: `${(i.valor / max) * 100}%`, minHeight: i.valor ? 2 : 0, background: destaque?.chave === i.chave ? destaque.cor : (i.cor ?? cor) }} />
          </span>
          <span className="mt-1 w-full border-t border-borda-forte pt-1 text-center text-[11.5px] leading-tight text-texto-2">{i.rotulo}</span>
        </li>
      ))}
    </ol>
  );
}

/** Uma barra de duas partes (dentro / fora de um limite), com os dois números escritos. */
export function BarraLimite({ dentro, fora, rotuloDentro, rotuloFora }: { dentro: number; fora: number; rotuloDentro: string; rotuloFora: string }) {
  const total = dentro + fora || 1;
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-[2px]" role="img" aria-label={`${rotuloDentro}: ${dentro}; ${rotuloFora}: ${fora}`}>
        <span style={{ width: `${(dentro / total) * 100}%`, background: "#1c8a2c" }} />
        {fora > 0 && <span style={{ width: `${(fora / total) * 100}%`, minWidth: 3, background: "#c4281c" }} />}
      </div>
      <p className="num mt-1 flex justify-between text-[12.5px] text-texto-2">
        <span><b className="text-texto">{dentro}</b> {rotuloDentro}</span>
        <span><b className={fora ? "text-vermelho" : "text-texto"}>{fora}</b> {rotuloFora}</span>
      </p>
    </div>
  );
}

/**
 * Rosca de partes de um todo, com o percentual escrito em cada fatia e o total no centro.
 * Fatias separadas por 2 px; clicáveis quando `aoClicar` é dado. A legenda fica ao lado (BarrasH), não aqui.
 */
export function Rosca({ itens, aoClicar, ativos, rotuloCentro, tamanho = 168 }: {
  itens: ItemGrafico[]; aoClicar?: (chave: string) => void; ativos?: Set<string>; rotuloCentro: string; tamanho?: number;
}) {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const R = 50, r = 30, c = 60;
  // duas casas: o servidor e o navegador precisam escrever exatamente o mesmo caminho
  const ponto = (ang: number, raio: number) => [Math.round((c + raio * Math.sin(ang)) * 100) / 100, Math.round((c - raio * Math.cos(ang)) * 100) / 100];
  const visiveis = itens.filter((i) => i.valor > 0);
  const fatias = visiveis.map((i, k) => {
    const fracao = i.valor / (total || 1);
    const a0 = (visiveis.slice(0, k).reduce((s, x) => s + x.valor, 0) / (total || 1)) * Math.PI * 2;
    const a1 = a0 + fracao * Math.PI * 2;
    const folga = fracao < 1 ? 0.018 : 0;
    const [x0, y0] = ponto(a0 + folga, R), [x1, y1] = ponto(a1 - folga, R), [x2, y2] = ponto(a1 - folga, r), [x3, y3] = ponto(a0 + folga, r);
    const grande = a1 - a0 > Math.PI ? 1 : 0;
    const d = fracao >= 0.999
      ? `M${c} ${c - R} A${R} ${R} 0 1 1 ${c - 0.01} ${c - R} Z M${c} ${c - r} A${r} ${r} 0 1 0 ${c + 0.01} ${c - r} Z`
      : `M${x0} ${y0} A${R} ${R} 0 ${grande} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${grande} 0 ${x3} ${y3} Z`;
    const [tx, ty] = ponto((a0 + a1) / 2, (R + r) / 2);
    return { ...i, d, tx, ty, pct: Math.round(fracao * 100) };
  });
  return (
    <svg viewBox="0 0 120 120" width={tamanho} height={tamanho} role="img" aria-label={`${rotuloCentro}: ${fatias.map((f) => `${f.rotulo} ${f.pct}%`).join(", ")}`} className="shrink-0">
      {fatias.map((f) => (
        <g key={f.chave} onClick={aoClicar ? () => aoClicar(f.chave) : undefined} className={clsx(aoClicar && "cursor-pointer", ativos && !ativos.has(f.chave) && "opacity-35")}>
          <title>{`${f.rotulo}: ${f.valor} (${f.pct}%)`}</title>
          <path d={f.d} fill={f.cor ?? "#1351b4"} fillRule="evenodd" />
          {f.pct >= 7 && <text x={f.tx} y={f.ty + 3} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#fff" stroke="#1b2430" strokeWidth={0.25} paintOrder="stroke">{f.pct}%</text>}
        </g>
      ))}
      <text x={c} y={c - 1} textAnchor="middle" fontSize={17} fontWeight={700} fill="#1b2430">{total}</text>
      <text x={c} y={c + 10} textAnchor="middle" fontSize={7.5} fill="#667284">{rotuloCentro}</text>
    </svg>
  );
}
