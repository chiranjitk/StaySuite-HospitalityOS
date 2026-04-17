'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, FileJson, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DataExportProps {
  data: Record<string, unknown>[];
  filename: string;
  title?: string;
}

function convertToCSV(data: Record<string, unknown>[]): string {
  if (!data.length) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h];
      const str = val === null || val === undefined ? '' : String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

function convertToTSV(data: Record<string, unknown>[]): string {
  if (!data.length) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h];
      return val === null || val === undefined ? '' : String(val);
    }).join('\t')
  );
  return [headers.join('\t'), ...rows].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DataExport({ data, filename, title }: DataExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async (format: 'csv' | 'tsv' | 'json') => {
    setIsExporting(true);
    try {
      // Small delay for UX feedback
      await new Promise(r => setTimeout(r, 300));

      const ext = format === 'tsv' ? 'csv' : format;
      const baseName = filename.replace(/\.[^.]+$/, '');

      switch (format) {
        case 'csv':
          downloadFile(convertToCSV(data), `${baseName}.csv`, 'text/csv');
          break;
        case 'tsv':
          downloadFile(convertToTSV(data), `${baseName}_spreadsheet.csv`, 'text/tab-separated-values');
          break;
        case 'json':
          downloadFile(JSON.stringify(data, null, 2), `${baseName}.json`, 'application/json');
          break;
      }

      toast.success(`${title || 'Data'} exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [data, filename, title]);

  if (!data?.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all"
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-emerald-600" />
          <div>
            <p className="text-sm font-medium">CSV</p>
            <p className="text-[10px] text-muted-foreground">Comma-separated values</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('tsv')} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-sky-600" />
          <div>
            <p className="text-sm font-medium">Spreadsheet</p>
            <p className="text-[10px] text-muted-foreground">Tab-separated for Excel</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')} className="gap-2 cursor-pointer">
          <FileJson className="h-4 w-4 text-amber-600" />
          <div>
            <p className="text-sm font-medium">JSON</p>
            <p className="text-[10px] text-muted-foreground">Structured data format</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
