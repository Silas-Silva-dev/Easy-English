/**
 * Confere se a chave dedicada esta mesmo no nivel pago: dispara chamadas em
 * rajada e mede quantas passam sem 429. No gratuito o teto e ~3 por minuto.
 */
import { genaiTts, usingDedicatedTtsKey } from "./_shared";

async function uma(model: string, i: number) {
  const t0 = Date.now();
  try {
    const r = await genaiTts().models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: `Say clearly: test number ${i}.` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      },
    });
    const inline = r.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const bytes = inline?.data ? Buffer.from(inline.data, "base64").length : 0;
    return { ok: true, ms: Date.now() - t0, bytes, tokens: r.usageMetadata?.candidatesTokenCount ?? 0 };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return { ok: false, ms: Date.now() - t0, erro: /\b(\d{3})\b/.exec(m)?.[1] ?? "?", msg: m.slice(0, 120) };
  }
}

async function main() {
  console.log("chave dedicada em uso:", usingDedicatedTtsKey() ? "SIM" : "NAO (caiu na GEMINI_API_KEY)");
  for (const model of ["gemini-2.5-pro-preview-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"]) {
    // 6 chamadas simultaneas: no gratuito isso estoura na hora.
    const res = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => uma(model, i)));
    const ok = res.filter((r) => r.ok).length;
    const erros = [...new Set(res.filter((r) => !r.ok).map((r: any) => r.erro))];
    console.log(
      `  ${model.padEnd(30)} ${ok}/6 em rajada` +
      (erros.length ? `  erros=${erros.join(",")}` : "  sem 429") +
      `  media=${Math.round(res.reduce((a, r) => a + r.ms, 0) / res.length)}ms`,
    );
    const falha = res.find((r: any) => !r.ok) as any;
    if (falha) console.log(`      ${falha.msg}`);
  }
}
main();
