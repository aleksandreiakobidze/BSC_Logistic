"use client";

import { useTranslations } from "next-intl";
import { FileText, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface AttachmentRow {
  id: string;
  name: string;
  fileUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

interface RfqAttachmentsCardProps {
  documents: AttachmentRow[];
  locale: string;
}

/**
 * Lists existing `Document` rows scoped to this quotation. Upload UI is
 * intentionally deferred to a follow-up — RFQ attachments use the existing
 * `Document` model so any future generic uploader will surface them
 * automatically.
 */
export function RfqAttachmentsCard({
  documents,
  locale,
}: RfqAttachmentsCardProps) {
  const t = useTranslations();
  const fmtDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {t("quotations.inquiry.rfqAttachments")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
            <Paperclip className="h-6 w-6" />
            <span>—</span>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  {d.fileUrl ? (
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      {d.name}
                    </a>
                  ) : (
                    <span className="font-medium">{d.name}</span>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {fmtDate.format(new Date(d.createdAt))}
                    {d.sizeBytes != null
                      ? ` · ${formatBytes(d.sizeBytes)}`
                      : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
