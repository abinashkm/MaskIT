/** Luhn checksum used by payment card numbers. Input must be digits only. */
export function luhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** IBAN mod-97 check. Spaces are ignored. */
export function ibanValid(raw: string): boolean {
  const iban = raw.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** US SSN structural rules: no 000/666/9xx area, no 00 group, no 0000 serial. */
export function ssnValid(area: string, group: string, serial: string): boolean {
  if (area === "000" || area === "666" || area.startsWith("9")) return false;
  if (group === "00" || serial === "0000") return false;
  return true;
}

/** ABA routing number checksum (9 digits). */
export function abaValid(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false;
  const d = digits.split("").map(Number);
  const [a, b, c, e, f, g, h, i, j] = d as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return (3 * (a + e + h) + 7 * (b + f + i) + (c + g + j)) % 10 === 0;
}

export function ipv4Valid(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every(
    (p) => /^\d{1,3}$/.test(p) && Number(p) <= 255 && (p === "0" || !p.startsWith("0")),
  );
}

export function ipv6Valid(ip: string): boolean {
  if (!/^[0-9a-fA-F:]+$/.test(ip) || ip.includes(":::")) return false;
  const halves = ip.split("::");
  if (halves.length > 2) return false;
  const groups = halves.flatMap((h) => (h === "" ? [] : h.split(":")));
  if (!groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g))) return false;
  return halves.length === 2 ? groups.length < 8 : groups.length === 8;
}

export function validDayMonth(month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}
