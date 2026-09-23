const FORMULA_PREFIX = /^[\s\u0000-\u001f\u007f-\u009f\ufeff]*[=+\-@]/u;
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

export function csvEscape(value: string): string {
  const trimmed = value.trim();
  const isNumber = NUMBER.test(trimmed);
  const safeValue = !isNumber && FORMULA_PREFIX.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safeValue)) return `"${safeValue.replace(/"/g, '""')}"`;
  return safeValue;
}
