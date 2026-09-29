export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}
