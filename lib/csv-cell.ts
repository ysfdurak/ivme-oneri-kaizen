/** CSV hücresi: Excel'in formül sanmaması için =, +, -, @, sekme veya satır başıyla başlayan metnin önüne
 * kesme işareti (') konur (CSV/formül enjeksiyonu). Sayılar (-5, 1.250,75) olduğu gibi kalır; içerik silinmez. */
export function csvSafe(value: string) {
  return /^[=+\-@\t\r]/.test(value) && !/^[-+]?\d[\d.,]*%?$/.test(value) ? "'" + value : value;
}
