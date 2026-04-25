/**
 * Report Export Utilities
 * Provides CSV and PDF generation for various reports
 */

// Type definitions for report data
export interface ExportOptions {
  format: 'csv' | 'pdf' | 'excel';
  title: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  propertyId?: string;
  tenantId: string;
}

export interface ColumnDefinition {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: 'currency' | 'percentage' | 'number' | 'date' | 'datetime';
}

/**
 * Format a value based on its type
 */
function formatValue(value: unknown, format?: ColumnDefinition['format']): string {
  if (value === null || value === undefined) return '';
  
  switch (format) {
    case 'currency':
      return typeof value === 'number' ? `$${value.toFixed(2)}` : String(value);
    case 'percentage':
      return typeof value === 'number' ? `${value.toFixed(1)}%` : String(value);
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'date':
      return value instanceof Date ? value.toLocaleDateString() : String(value);
    case 'datetime':
      return value instanceof Date ? value.toLocaleString() : String(value);
    default:
      return String(value);
  }
}

/**
 * Escape CSV field
 */
function escapeCSV(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Generate CSV content from data
 */
export function generateCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ColumnDefinition[]
): string {
  // Header row
  const header = columns.map(col => escapeCSV(col.label)).join(',');
  
  // Data rows
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      return escapeCSV(formatValue(value, col.format));
    }).join(',')
  );
  
  return [header, ...rows].join('\n');
}

/**
 * Generate HTML table for PDF
 */
export function generateHTMLTable<T extends Record<string, unknown>>(
  data: T[],
  columns: ColumnDefinition[],
  options: ExportOptions
): string {
  const title = options.title;
  const dateRange = options.dateRange;
  
  // Column widths
  const totalWidth = columns.reduce((sum, col) => sum + (col.width || 100), 0);
  
  const tableRows = data.map(row => 
    `<tr>${columns.map(col => {
      const value = row[col.key];
      const formatted = formatValue(value, col.format);
      const align = col.align || 'left';
      return `<td style="text-align: ${align}; padding: 8px; border: 1px solid #ddd;">${formatted}</td>`;
    }).join('')}</tr>`
  ).join('\n');
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #4a5568;
      padding-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      color: #2d3748;
      font-size: 24px;
    }
    .header .subtitle {
      color: #718096;
      font-size: 14px;
      margin-top: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: 12px;
    }
    th {
      background-color: #4a5568;
      color: white;
      padding: 10px 8px;
      text-align: left;
      border: 1px solid #2d3748;
    }
    td {
      padding: 8px;
      border: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background-color: #f7fafc;
    }
    tr:hover {
      background-color: #edf2f7;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      color: #718096;
      font-size: 11px;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
    }
    .summary {
      margin: 20px 0;
      padding: 15px;
      background-color: #f7fafc;
      border-radius: 4px;
      border-left: 4px solid #4a5568;
    }
    .summary-title {
      font-weight: bold;
      margin-bottom: 10px;
    }
    .summary-content {
      display: flex;
      gap: 30px;
    }
    .summary-item {
      text-align: center;
    }
    .summary-value {
      font-size: 20px;
      font-weight: bold;
      color: #2d3748;
    }
    .summary-label {
      font-size: 11px;
      color: #718096;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="subtitle">
      ${dateRange ? `Period: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}` : ''}
      ${options.propertyId ? ` | Property ID: ${options.propertyId}` : ''}
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        ${columns.map(col => {
          const align = col.align || 'left';
          return `<th style="text-align: ${align};">${col.label}</th>`;
        }).join('')}
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  
  <div class="footer">
    <p>Generated on ${new Date().toLocaleString()}</p>
    <p>StaySuite HospitalityOS - Confidential Report</p>
  </div>
</body>
</html>
  `;
  
  return html;
}

/**
 * Generate Excel-compatible XML (SpreadsheetML)
 */
export function generateExcelXML<T extends Record<string, unknown>>(
  data: T[],
  columns: ColumnDefinition[],
  options: ExportOptions
): string {
  const worksheetName = options.title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 31);
  
  // Build XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#4A5568" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF"/>
    </Style>
    <Style ss:ID="Currency">
      <NumberFormat ss:Format="$#,##0.00"/>
    </Style>
    <Style ss:ID="Percent">
      <NumberFormat ss:Format="0.0%"/>
    </Style>
    <Style ss:ID="Date">
      <NumberFormat ss:Format="yyyy-mm-dd"/>
    </Style>
    <Style ss:ID="DateTime">
      <NumberFormat ss:Format="yyyy-mm-dd hh:mm:ss"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${worksheetName}">
    <Table>
      <Column ss:Width="100"/>
      ${columns.map(col => `<Column ss:Width="${col.width || 100}"/>`).join('\n')}
      <Row ss:StyleID="Header">
        ${columns.map(col => `<Cell><Data ss:Type="String">${col.label}</Data></Cell>`).join('\n')}
      </Row>
`;

  data.forEach(row => {
    xml += '      <Row>\n';
    columns.forEach(col => {
      const value = row[col.key];
      let type = 'String';
      let styleId = '';
      
      if (typeof value === 'number') {
        type = 'Number';
        if (col.format === 'currency') styleId = ' ss:StyleID="Currency"';
        if (col.format === 'percentage') styleId = ' ss:StyleID="Percent"';
      } else if (value instanceof Date) {
        type = 'DateTime';
        styleId = col.format === 'date' ? ' ss:StyleID="Date"' : ' ss:StyleID="DateTime"';
      }
      
      const displayValue = formatValue(value, type === 'String' ? col.format : undefined);
      xml += `        <Cell${styleId}><Data ss:Type="${type}">${displayValue}</Data></Cell>\n`;
    });
    xml += '      </Row>\n';
  });

  xml += `    </Table>
  </Worksheet>
</Workbook>`;

  return xml;
}

/**
 * Calculate summary statistics for a report
 */
export function calculateSummary<T extends Record<string, unknown>>(
  data: T[],
  columns: ColumnDefinition[]
): Record<string, { sum: number; avg: number; min: number; max: number; count: number }> {
  const summary: Record<string, { sum: number; avg: number; min: number; max: number; count: number }> = {};
  
  columns.forEach(col => {
    if (col.format === 'currency' || col.format === 'number' || col.format === 'percentage') {
      const values = data
        .map(row => typeof row[col.key] === 'number' ? row[col.key] as number : null)
        .filter((v): v is number => v !== null);
      
      if (values.length > 0) {
        summary[col.key] = {
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
        };
      }
    }
  });
  
  return summary;
}

/**
 * Get MIME type for export format
 */
export function getMimeType(format: 'csv' | 'pdf' | 'excel'): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'pdf':
      return 'application/pdf';
    case 'excel':
      return 'application/vnd.ms-excel';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Get file extension for export format
 */
export function getFileExtension(format: 'csv' | 'pdf' | 'excel'): string {
  switch (format) {
    case 'csv':
      return '.csv';
    case 'pdf':
      return '.pdf';
    case 'excel':
      return '.xls';
    default:
      return '';
  }
}
