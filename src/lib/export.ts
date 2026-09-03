export interface ExportColumn<T> {
  header: string;
  key: keyof T | ((item: T) => string | number | undefined | null);
}

export function exportToCSV<T>(data: T[], columns: ExportColumn<T>[], filename: string): void {
  if (!data || data.length === 0) return;

  const headers = columns.map(c => `"${String(c.header).replace(/"/g, '""')}"`).join(',');

  const rows = data.map(item => {
    return columns
      .map(col => {
        let val: any;
        if (typeof col.key === 'function') {
          val = col.key(item);
        } else {
          val = item[col.key];
        }

        if (val === null || val === undefined) val = '';
        const stringVal = String(val).replace(/"/g, '""');
        return `"${stringVal}"`;
      })
      .join(',');
  });

  const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
