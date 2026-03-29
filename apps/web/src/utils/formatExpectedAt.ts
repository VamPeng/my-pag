/** `<input type="datetime-local">` 的 value（本地时区，精度到分钟） */
export function isoToDatetimeLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 将 datetime-local 解析为 ISO 字符串；空串表示清除 */
export function datetimeLocalInputValueToIso(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** 卡片等处展示（本地时区）：同年为 mm.dd hh:mm；跨年为 yyyy.mm.dd hh:mm */
export function formatExpectedAtDisplay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const nowY = new Date().getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const time = `${hh}:${min}`;
  if (y !== nowY) {
    return `${y}.${mm}.${dd} ${time}`;
  }
  return `${mm}.${dd} ${time}`;
}
