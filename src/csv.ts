import type { SaleEvent } from './db';

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function eventsToCsv(events: SaleEvent[]): string {
  const header = 'time,item,variant,price,payment,type';
  const rows = events.map((e) =>
    [
      new Date(e.ts).toISOString(),
      esc(e.itemName),
      esc(e.variantName || '-'),
      e.price.toFixed(2),
      e.payment,
      e.type,
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
