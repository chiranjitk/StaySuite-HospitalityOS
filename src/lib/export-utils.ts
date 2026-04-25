/**
 * Data Export Utility
 * Provides CSV and JSON export functions with proper formatting
 */

interface ExportColumn {
  key: string;
  label: string;
}

/**
 * Format a number using Indian number system (e.g., 1,23,456.00)
 */
function formatIndianNumber(value: number): string {
  const parts = value.toFixed(2).split('.');
  const intPart = parts[0];
  const decimalPart = parts[1];

  if (parseInt(intPart) >= 0) {
    // Positive numbers
    const lastThree = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return (rest ? formatted + ',' : '') + lastThree + '.' + decimalPart;
  } else {
    // Negative numbers
    const absInt = intPart.slice(1);
    const lastThree = absInt.slice(-3);
    const rest = absInt.slice(0, -3);
    const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return '-' + (rest ? formatted + ',' : '') + lastThree + '.' + decimalPart;
  }
}

/**
 * Format a value for CSV output
 * Strings with commas/newlines/quotes get wrapped in quotes
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);

  if (typeof value === 'number') {
    return formatIndianNumber(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (value instanceof Date) {
    return value.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // Escape strings that contain special characters
  if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

/**
 * Export data as CSV file with UTF-8 BOM for Excel compatibility
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns: ExportColumn[]
): void {
  if (!data || data.length === 0) {
    console.warn('exportToCSV: No data to export');
    return;
  }

  // Build CSV content
  const headerRow = columns.map((col) => escapeCSVValue(col.label)).join(',');
  const dataRows = data.map((row) =>
    columns
      .map((col) => {
        let value = row[col.key];

        // Handle nested objects - get the value by key path
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // For nested objects like primaryGuest.firstName
          const obj = value as Record<string, unknown>;
          if (col.key.includes('.')) {
            const parts = col.key.split('.');
            let current: unknown = row;
            for (const part of parts) {
              if (current && typeof current === 'object') {
                current = (current as Record<string, unknown>)[part];
              } else {
                current = '';
                break;
              }
            }
            value = current;
          }
        }

        // Handle date strings
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              return escapeCSVValue(date.toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              }));
            }
          } catch {
            // Not a valid date, use as-is
          }
        }

        return escapeCSVValue(value);
      })
      .join(',')
  );

  const csvContent = [headerRow, ...dataRows].join('\n');

  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

  // Trigger download
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data as JSON file with proper formatting
 */
export function exportToJSON(
  data: Record<string, unknown>[],
  filename: string
): void {
  if (!data || data.length === 0) {
    console.warn('exportToJSON: No data to export');
    return;
  }

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], {
    type: 'application/json;charset=utf-8;',
  });

  // Trigger download
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data as formatted text file (PDF-like)
 */
export function exportToText(
  data: Record<string, unknown>[],
  filename: string,
  columns: ExportColumn[],
  title?: string
): void {
  if (!data || data.length === 0) {
    console.warn('exportToText: No data to export');
    return;
  }

  // Calculate column widths
  const colWidths = columns.map((col) => {
    const labelWidth = col.label.length;
    const maxDataWidth = data.reduce((max, row) => {
      const val = String(row[col.key] || '');
      return Math.max(max, val.length);
    }, 0);
    return Math.min(Math.max(labelWidth, maxDataWidth), 40);
  });

  const separator = '+' + colWidths.map((w) => '-'.repeat(w + 2)).join('+') + '+';

  let content = '';
  if (title) {
    content += title + '\n';
    content += 'Generated: ' + new Date().toLocaleString('en-IN') + '\n\n';
  }

  // Header
  content += separator + '\n';
  content +=
    '|' +
    columns
      .map((col, i) => ' ' + col.label.padEnd(colWidths[i]) + ' ')
      .join('|') +
    '|\n';
  content += separator + '\n';

  // Data rows
  data.forEach((row) => {
    content +=
      '|' +
      columns
        .map((col, i) => {
          const val = String(row[col.key] || '').substring(0, colWidths[i]);
          return ' ' + val.padEnd(colWidths[i]) + ' ';
        })
        .join('|') +
      '|\n';
  });

  content += separator + '\n';
  content += '\nTotal records: ' + data.length + '\n';

  const blob = new Blob([content], {
    type: 'text/plain;charset=utf-8;',
  });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.txt`);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
