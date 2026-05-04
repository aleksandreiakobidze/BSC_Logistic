import * as XLSX from "xlsx";

export type SheetRow = Record<string, string | number | null | undefined>;

/**
 * Build an xlsx Workbook from one or more named sheets.
 */
export function buildWorkbook(
  sheets: { name: string; rows: SheetRow[] }[],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-width columns
    const cols = rows.length
      ? Object.keys(rows[0]).map((key) => {
          const maxLen = Math.max(
            key.length,
            ...rows.map((r) => String(r[key] ?? "").length),
          );
          return { wch: Math.min(maxLen + 2, 60) };
        })
      : [];
    ws["!cols"] = cols;
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  return wb;
}

/**
 * Serialize workbook to a Buffer suitable for Next.js Response.
 */
export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  const raw = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return Buffer.from(raw);
}

/**
 * Build xlsx Response with proper headers.
 */
export function xlsxResponse(
  wb: XLSX.WorkBook,
  filename: string,
): Response {
  const buf = workbookToBuffer(wb);
  // Wrap in Uint8Array — `Response` accepts BodyInit but the global Buffer
  // type is too narrow under recent @types/node.
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}

/**
 * Build CSV Response with UTF-8 BOM so Excel opens it correctly.
 */
export function csvResponse(rows: SheetRow[], filename: string): Response {
  if (rows.length === 0) {
    return new Response("\uFEFF", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}

/**
 * Parse the first sheet of an uploaded .xlsx/.csv buffer into an array of
 * row objects keyed by header label. `raw: false` returns date / number
 * cells as formatted strings, which is friendlier for downstream coercion.
 */
export function parseSheetFromBuffer(buf: Buffer): SheetRow[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });
  return rows as SheetRow[];
}

/**
 * Build a single-sheet workbook used as the import template. Produces a
 * header row (using each `label`) plus one example data row so users can
 * see the expected shape.
 */
export function buildTemplate(
  headers: { key: string; label: string; example?: string | number }[],
  sheetName = "Sheet1",
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const headerRow = headers.map((h) => h.label);
  const exampleRow = headers.map((h) =>
    h.example == null ? "" : String(h.example),
  );
  const ws = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
  ws["!cols"] = headers.map((h) => ({
    wch: Math.max(h.label.length, String(h.example ?? "").length, 12) + 2,
  }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return wb;
}
