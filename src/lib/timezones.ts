/**
 * Fusos aceitos no perfil.
 *
 * Não é decoração: `register_study_activity` calcula `now() at time zone <fuso>`
 * para saber quando o dia vira — ou seja, este valor decide a que horas a
 * ofensiva do aluno zera.
 *
 * A lista é a mesma de antes, apenas com rótulo legível. Trocar ou remover um
 * valor daqui quebraria o `select` de quem já o tem salvo (o navegador cairia na
 * primeira opção e sobrescreveria o fuso do aluno no primeiro "Salvar"), então
 * só se acrescenta.
 *
 * Compartilhado de propósito entre o formulário (client) e o zod da Server
 * Action (server): é o mesmo conjunto validando os dois lados.
 */
export const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília, São Paulo, Rio, Sul e Nordeste (UTC−3)" },
  { value: "America/Fortaleza", label: "Fortaleza, Recife, Natal (UTC−3)" },
  { value: "America/Belem", label: "Belém, Macapá (UTC−3)" },
  { value: "America/Manaus", label: "Manaus, Boa Vista, Porto Velho (UTC−4)" },
  { value: "America/Cuiaba", label: "Cuiabá, Campo Grande (UTC−4)" },
  { value: "America/Rio_Branco", label: "Rio Branco, Acre (UTC−5)" },
  { value: "America/Noronha", label: "Fernando de Noronha (UTC−2)" },
  { value: "UTC", label: "UTC (fora do Brasil)" },
] as const;

export type Timezone = (typeof TIMEZONES)[number]["value"];

/** Tupla não-vazia — o formato que `z.enum()` exige. */
export const TIMEZONE_VALUES = TIMEZONES.map((t) => t.value) as unknown as [
  Timezone,
  ...Timezone[],
];
