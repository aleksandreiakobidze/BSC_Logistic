"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Upload, FileSpreadsheet, Loader2, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ImportEntity = "customers" | "orders";

type RowResult = {
  rowIndex: number;
  ok: boolean;
  id?: string;
  error?: string;
};

type ImportResponse = {
  created: number;
  failed: number;
  rows: RowResult[];
};

/**
 * Reusable import dialog. Auto-fetches a fresh template (built-in + custom
 * fields) from `/api/import/{entity}/template`, accepts a single .xlsx/.csv
 * upload, and posts to `/api/import/{entity}` returning a per-row report.
 */
export function ImportButton({ entity }: { entity: ImportEntity }) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<ImportResponse | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      toast.error(t("import.noFile"));
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/import/${entity}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ImportResponse;
      setResult(data);
      if (data.failed === 0) {
        toast.success(
          t("import.successWithCount", { count: data.created }),
        );
      } else if (data.created === 0) {
        toast.error(t("import.allFailed"));
      } else {
        toast(
          t("import.partial", { created: data.created, failed: data.failed }),
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("import.uploadError"));
    } finally {
      setSubmitting(false);
    }
  }

  const failedRows = result?.rows.filter((r) => !r.ok) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          {t("import.action")}
        </Button>
      </DialogTrigger>
      <DialogContent withDescription className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {entity === "customers"
              ? t("import.customersTitle")
              : t("import.ordersTitle")}
          </DialogTitle>
          <DialogDescription>{t("import.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{t("import.templateTitle")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("import.templateHint")}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/import/${entity}/template`} download>
                  <Download className="mr-2 h-4 w-4" />
                  {t("import.downloadTemplate")}
                </a>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("import.fileLabel")}
            </label>
            <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={submitting}
              />
            </div>
            {file ? (
              <p className="text-xs text-muted-foreground">{file.name}</p>
            ) : null}
          </div>

          {result ? (
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">
                    {t("import.createdCount", { count: result.created })}
                  </span>
                </div>
                {result.failed > 0 ? (
                  <div className="flex items-center gap-1.5 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">
                      {t("import.failedCount", { count: result.failed })}
                    </span>
                  </div>
                ) : null}
              </div>
              {failedRows.length > 0 ? (
                <div className="mt-3 max-h-48 overflow-auto rounded-md border bg-muted/30">
                  <table className="w-full text-xs">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="w-16 px-2 py-1 text-left">
                          {t("import.row")}
                        </th>
                        <th className="px-2 py-1 text-left">
                          {t("import.error")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {failedRows.map((r) => (
                        <tr key={r.rowIndex} className="border-t">
                          <td className="px-2 py-1 font-mono">{r.rowIndex}</td>
                          <td className="px-2 py-1 text-destructive">
                            {r.error}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {result ? t("common.close") : t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!file || submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {t("import.action")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
