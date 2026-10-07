import katex from "katex";

/**
 * Server-rendered LaTeX via KaTeX. No account JS — formulas arrive as static
 * HTML. katex CSS is imported once in the /help layout.
 *
 *   <Math tex="\frac{m}{r} \times 100" />          inline
 *   <Math tex="..." display />                      centered block
 */
export function Math({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    strict: false,
    output: "htmlAndMathml",
  });
  if (display) {
    return (
      <div
        className="my-5 overflow-x-auto py-1 [&_.katex]:text-[1.05rem]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
