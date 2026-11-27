const digits: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};
export function chineseNumber(value: string): number {
  const s = value
    .replace(/^初/, "")
    .replace(/^廿/, "二十")
    .replace(/^卅/, "三十");
  if (/^\d+$/.test(s)) return +s;
  if (/^[零〇一二两三四五六七八九]{2,}$/.test(s))
    return +[...s].map((x) => digits[x]).join("");
  if (s.includes("十")) {
    const [a, b] = s.split("十");
    return (a ? digits[a] : 1) * 10 + (b ? digits[b] : 0);
  }
  return digits[s] ?? NaN;
}
export function normalizeSpokenYears(text: string) {
  return text.replace(
    /([零〇一二两三四五六七八九]{4})年/g,
    (_, year: string) => `${chineseNumber(year)}年`,
  );
}
export function normalizeSpokenDates(text: string) {
  return text.replace(/([零〇一二两三四五六七八九十\d]{1,3})月([初廿卅零〇一二两三四五六七八九十\d]{1,4})[日号]/g,
    (whole, month: string, day: string) => {
      const m = chineseNumber(month), d = chineseNumber(day);
      return m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${m}月${d}日` : whole;
    });
}
