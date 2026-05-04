"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  RotateCcw,
  Loader2,
  Check,
  AlertTriangle,
  ChevronDown,
  Upload,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import {
  DEFAULT_TEMPLATE,
  TEMPLATE_PRESETS,
  type Block,
  type BlockId,
  type FontFamily,
  type FontWeight,
  type InvoiceTemplate,
  type LabelKey,
  type LineColumns,
  type LogoPosition,
  type PageSize,
  type TextAlign,
} from "@/lib/invoice-template";
import { saveInvoiceTemplate, updateOrganizationLogo } from "../actions";
import { BlockList } from "./block-list";

const SIGNATURE_LABEL_FALLBACK = "Authorized signature";

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string }
  | { kind: "dirty" };

interface InvoiceDesignerProps {
  initialTemplate: InvoiceTemplate;
  orgName: string;
  initialLogoUrl: string | null;
  baseCurrency: string;
}

export function InvoiceDesigner({
  initialTemplate,
  orgName,
  initialLogoUrl,
  baseCurrency,
}: InvoiceDesignerProps) {
  const t = useTranslations();
  const [template, setTemplate] = React.useState<InvoiceTemplate>(initialTemplate);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(initialLogoUrl);
  const [selectedId, setSelectedId] = React.useState<BlockId | null>("header");
  const [previewSource, setPreviewSource] = React.useState<"sample" | "latest">(
    "sample",
  );
  const [previewToken, setPreviewToken] = React.useState(0);
  const [previewSrc, setPreviewSrc] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>({ kind: "idle" });

  const dirtyRef = React.useRef(false);
  const lastSavedJsonRef = React.useRef<string>(JSON.stringify(initialTemplate));

  function tx(key: string, fb: string): string {
    return t.has(key) ? t(key) : fb;
  }

  // ─── Mutators ──────────────────────────────────────────────────────────
  function patch(patch: Partial<InvoiceTemplate>) {
    setTemplate((prev) => ({ ...prev, ...patch }));
    markDirty();
  }
  function patchBlock(id: BlockId, p: Partial<Block>) {
    setTemplate((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...p } : b)),
    }));
    markDirty();
  }
  function toggleBlock(id: BlockId) {
    patchBlock(id, {
      visible: !(template.blocks.find((b) => b.id === id)?.visible ?? false),
    });
  }
  function reorderBlocks(blocks: Block[]) {
    setTemplate((prev) => ({ ...prev, blocks }));
    markDirty();
  }
  function setLineColumn<K extends keyof LineColumns>(key: K, value: boolean) {
    patch({ lineColumns: { ...template.lineColumns, [key]: value } });
  }
  function setLabel(key: LabelKey, value: string) {
    const nextLabels = { ...template.labels };
    if (value.trim()) nextLabels[key] = value;
    else delete nextLabels[key];
    patch({ labels: nextLabels });
  }
  function markDirty() {
    dirtyRef.current = true;
    setSaveStatus({ kind: "dirty" });
  }

  // ─── Autosave (800ms debounce) ─────────────────────────────────────────
  React.useEffect(() => {
    if (!dirtyRef.current) return;
    const handle = setTimeout(async () => {
      const snapshot = JSON.stringify(template);
      if (snapshot === lastSavedJsonRef.current) {
        dirtyRef.current = false;
        setSaveStatus({ kind: "saved", at: Date.now() });
        return;
      }
      setSaveStatus({ kind: "saving" });
      try {
        await saveInvoiceTemplate(template);
        lastSavedJsonRef.current = snapshot;
        dirtyRef.current = false;
        setSaveStatus({ kind: "saved", at: Date.now() });
      } catch (err) {
        setSaveStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "Save failed",
        });
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [template]);

  // ─── Preview iframe (debounced re-render) ──────────────────────────────
  React.useEffect(() => {
    const handle = setTimeout(() => {
      setPreviewToken((t) => t + 1);
    }, 600);
    return () => clearTimeout(handle);
  }, [template, previewSource]);

  React.useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setPreviewLoading(true);
    setPreviewError(null);
    fetch("/api/invoice-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template, source: previewSource }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreviewSrc(url);
      })
      .catch((err) => {
        if (cancelled) return;
        setPreviewError(err instanceof Error ? err.message : "Preview failed");
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewToken]);

  // ─── Logo upload ──────────────────────────────────────────────────────
  async function uploadLogo(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { url: string };
      setLogoUrl(data.url);
      await updateOrganizationLogo(data.url);
      // The preview reads logo via Organization.logoUrl, so we kick a refresh
      setPreviewToken((t) => t + 1);
      toast.success(tx("invoiceDesigner.saved", "Saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function removeLogo() {
    try {
      setLogoUrl(null);
      await updateOrganizationLogo(null);
      setPreviewToken((t) => t + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    }
  }

  // ─── Templates / Reset ─────────────────────────────────────────────────
  function applyPreset(name: keyof typeof TEMPLATE_PRESETS) {
    if (
      !confirm(
        tx(
          "invoiceDesigner.replaceConfirm",
          "Replace your current design with this template?",
        ),
      )
    )
      return;
    setTemplate(TEMPLATE_PRESETS[name]);
    markDirty();
  }
  function reset() {
    if (!confirm(tx("invoiceDesigner.resetConfirm", "Reset to default?"))) return;
    setTemplate(DEFAULT_TEMPLATE);
    markDirty();
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <SaveStatusBadge status={saveStatus} tx={tx} />
        </div>
        <div className="flex items-center gap-2">
          <PreviewSourceToggle
            value={previewSource}
            onChange={setPreviewSource}
            tx={tx}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                {tx("invoiceDesigner.templates", "Templates")}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => applyPreset("modern")}>
                {tx("invoiceDesigner.templateModern", "Modern")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyPreset("classic")}>
                {tx("invoiceDesigner.templateClassic", "Classic")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyPreset("minimal")}>
                {tx("invoiceDesigner.templateMinimal", "Minimal")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="gap-1"
          >
            <RotateCcw className="h-4 w-4" />
            {tx("invoiceDesigner.reset", "Reset")}
          </Button>
        </div>
      </div>

      <div
        className="grid gap-3 rounded-xl border bg-card overflow-hidden"
        style={{
          gridTemplateColumns: "240px 1fr 320px",
          minHeight: "78vh",
        }}
      >
        {/* Left rail — block list */}
        <div className="flex flex-col border-r">
          <div className="border-b px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {tx("invoiceDesigner.panelBlocks", "Blocks")}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <BlockList
              blocks={template.blocks}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggleVisible={toggleBlock}
              onReorder={reorderBlocks}
            />
          </div>
        </div>

        {/* Center — true PDF preview */}
        <div className="flex flex-col bg-muted/30">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {tx("invoiceDesigner.panelPreview", "Live Preview")}
            </p>
            {previewLoading && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {tx("invoiceDesigner.autoSaving", "Saving…")}
              </span>
            )}
          </div>
          <div className="relative flex-1 overflow-hidden">
            {previewError ? (
              <div className="flex h-full items-center justify-center p-6 text-sm text-destructive">
                {tx("invoiceDesigner.previewError", "Preview failed.")}
              </div>
            ) : previewSrc ? (
              <iframe
                title="Invoice preview"
                src={previewSrc}
                className="h-full w-full"
                style={{ border: "none", background: "#fff" }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tx("invoiceDesigner.autoSaving", "Loading preview…")}
              </div>
            )}
          </div>
        </div>

        {/* Right rail — focused editor */}
        <div className="flex flex-col border-l">
          <div className="border-b px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {selectedId
                ? template.blocks.find((b) => b.id === selectedId)?.label
                : tx("invoiceDesigner.panelStyle", "Style")}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {selectedId && (
              <BlockEditor
                block={template.blocks.find((b) => b.id === selectedId)!}
                template={template}
                logoUrl={logoUrl}
                baseCurrency={baseCurrency}
                tx={tx}
                onUploadLogo={uploadLogo}
                onRemoveLogo={removeLogo}
                onPatchBlock={patchBlock}
                onPatchTemplate={patch}
                onSetLineColumn={setLineColumn}
                onSetLabel={setLabel}
              />
            )}

            <Separator />

            {/* Branding (always shown) */}
            <BrandingPanel
              template={template}
              tx={tx}
              onPatch={patch}
            />
          </div>
        </div>
      </div>

      {/* Hidden helper: orgName is shown in PDF preview's header section already */}
      <p className="sr-only">{orgName}</p>
    </div>
  );
}

function SaveStatusBadge({
  status,
  tx,
}: {
  status: SaveStatus;
  tx: (k: string, fb: string) => string;
}) {
  if (status.kind === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {tx("invoiceDesigner.autoSaving", "Saving…")}
      </span>
    );
  }
  if (status.kind === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
        <Check className="h-3.5 w-3.5" />
        {tx("invoiceDesigner.autoSaved", "Saved")}
      </span>
    );
  }
  if (status.kind === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" />
        {tx("invoiceDesigner.autoSaveFailed", "Save failed — retry")}
      </span>
    );
  }
  if (status.kind === "dirty") {
    return (
      <span className="text-xs text-muted-foreground">
        {tx("invoiceDesigner.autoSaveDirty", "Unsaved changes")}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">&nbsp;</span>;
}

function PreviewSourceToggle({
  value,
  onChange,
  tx,
}: {
  value: "sample" | "latest";
  onChange: (v: "sample" | "latest") => void;
  tx: (k: string, fb: string) => string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as "sample" | "latest")}
    >
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <SelectValue
          placeholder={tx("invoiceDesigner.previewSource", "Preview using")}
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="sample">
          {tx("invoiceDesigner.sampleInvoice", "Sample invoice")}
        </SelectItem>
        <SelectItem value="latest">
          {tx("invoiceDesigner.latestInvoice", "Latest invoice")}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

function BrandingPanel({
  template,
  tx,
  onPatch,
}: {
  template: InvoiceTemplate;
  tx: (k: string, fb: string) => string;
  onPatch: (p: Partial<InvoiceTemplate>) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {tx("invoiceDesigner.branding", "Branding")}
      </p>
      <ColorField
        label={tx("invoiceDesigner.primaryColor", "Primary color")}
        value={template.primaryColor}
        onChange={(v) => onPatch({ primaryColor: v })}
      />
      <ColorField
        label={tx("invoiceDesigner.accentColor", "Accent color")}
        value={template.accentColor}
        onChange={(v) => onPatch({ accentColor: v })}
      />
      <div className="space-y-1">
        <Label className="text-xs">
          {tx("invoiceDesigner.fontFamily", "Font family")}
        </Label>
        <Select
          value={template.fontFamily}
          onValueChange={(v) => onPatch({ fontFamily: v as FontFamily })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Helvetica">Helvetica</SelectItem>
            <SelectItem value="Times-Roman">Times Roman</SelectItem>
            <SelectItem value="Courier">Courier</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">
          {tx("invoiceDesigner.pageSize", "Page size")}
        </Label>
        <Select
          value={template.pageSize}
          onValueChange={(v) => onPatch({ pageSize: v as PageSize })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A4">A4</SelectItem>
            <SelectItem value="Letter">Letter</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">
          {tx("invoiceDesigner.footerText", "Footer text")}
        </Label>
        <Input
          value={template.footerText}
          onChange={(e) => onPatch({ footerText: e.target.value })}
          className="h-8 text-xs"
        />
      </div>
      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <Label className="text-xs">
          {tx("invoiceDesigner.signature", "Signature line")}
        </Label>
        <Switch
          checked={template.signature.enabled}
          onCheckedChange={(v) =>
            onPatch({ signature: { ...template.signature, enabled: v } })
          }
        />
      </div>
      {template.signature.enabled && (
        <div className="space-y-1">
          <Label className="text-xs">
            {tx("invoiceDesigner.signatureLabel", "Signature label")}
          </Label>
          <Input
            value={template.signature.label}
            placeholder={SIGNATURE_LABEL_FALLBACK}
            onChange={(e) =>
              onPatch({
                signature: { ...template.signature, label: e.target.value },
              })
            }
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}

function BlockEditor({
  block,
  template,
  logoUrl,
  baseCurrency,
  tx,
  onUploadLogo,
  onRemoveLogo,
  onPatchBlock,
  onPatchTemplate,
  onSetLineColumn,
  onSetLabel,
}: {
  block: Block;
  template: InvoiceTemplate;
  logoUrl: string | null;
  baseCurrency: string;
  tx: (k: string, fb: string) => string;
  onUploadLogo: (f: File) => void;
  onRemoveLogo: () => void;
  onPatchBlock: (id: BlockId, p: Partial<Block>) => void;
  onPatchTemplate: (p: Partial<InvoiceTemplate>) => void;
  onSetLineColumn: <K extends keyof LineColumns>(k: K, v: boolean) => void;
  onSetLabel: (k: LabelKey, v: string) => void;
}) {
  // Per-block extra controls.
  const extras: React.ReactNode[] = [];
  if (block.id === "header") {
    extras.push(
      <LogoControls
        key="logo"
        template={template}
        logoUrl={logoUrl}
        tx={tx}
        onUpload={onUploadLogo}
        onRemove={onRemoveLogo}
        onPatch={onPatchTemplate}
      />,
    );
  }
  if (block.id === "notes") {
    extras.push(
      <div key="notes" className="space-y-1">
        <Label className="text-xs">
          {tx("invoiceDesigner.notes", "Notes content")}
        </Label>
        <Textarea
          rows={4}
          value={template.notes}
          placeholder={tx(
            "invoiceDesigner.notesPlaceholder",
            "Optional notes shown above the footer",
          )}
          onChange={(e) => onPatchTemplate({ notes: e.target.value })}
        />
      </div>,
    );
  }
  if (block.id === "paymentTerms") {
    extras.push(
      <div key="pt" className="space-y-1">
        <Label className="text-xs">
          {tx("invoiceDesigner.paymentTerms", "Payment terms")}
        </Label>
        <Textarea
          rows={3}
          value={template.paymentTerms}
          placeholder={tx(
            "invoiceDesigner.paymentTermsPlaceholder",
            "e.g. Net 30",
          )}
          onChange={(e) => onPatchTemplate({ paymentTerms: e.target.value })}
        />
      </div>,
    );
  }
  if (block.id === "bankDetails") {
    extras.push(
      <div key="bd" className="space-y-1">
        <Label className="text-xs">
          {tx("invoiceDesigner.bankDetails", "Bank details")}
        </Label>
        <Textarea
          rows={5}
          value={template.bankDetails}
          placeholder={tx(
            "invoiceDesigner.bankDetailsPlaceholder",
            "Account / IBAN / SWIFT",
          )}
          onChange={(e) => onPatchTemplate({ bankDetails: e.target.value })}
        />
      </div>,
    );
  }
  if (block.id === "table") {
    extras.push(
      <div key="cols" className="space-y-2">
        <Label className="text-xs">
          {tx("invoiceDesigner.lineColumns", "Line item columns")}
        </Label>
        <div className="space-y-1.5 rounded-md border p-2">
          <ColumnToggle
            label={tx("invoiceDesigner.colQty", "Quantity")}
            checked={template.lineColumns.qty}
            onChange={(v) => onSetLineColumn("qty", v)}
          />
          <ColumnToggle
            label={tx("invoiceDesigner.colUnitPrice", "Unit price")}
            checked={template.lineColumns.unitPrice}
            onChange={(v) => onSetLineColumn("unitPrice", v)}
          />
          <ColumnToggle
            label={tx("invoiceDesigner.colTaxRate", "Tax rate")}
            checked={template.lineColumns.taxRate}
            onChange={(v) => onSetLineColumn("taxRate", v)}
          />
          <ColumnToggle
            label={tx("invoiceDesigner.colDiscount", "Discount")}
            checked={template.lineColumns.discount}
            onChange={(v) => onSetLineColumn("discount", v)}
          />
          <ColumnToggle
            label={tx("invoiceDesigner.colLineTotal", "Line total")}
            checked={template.lineColumns.lineTotal}
            onChange={(v) => onSetLineColumn("lineTotal", v)}
          />
        </div>
      </div>,
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">
          {tx("invoiceDesigner.visible", "Visible")}
        </Label>
        <Switch
          checked={block.visible}
          onCheckedChange={(v) => onPatchBlock(block.id, { visible: v })}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">
          {tx("invoiceDesigner.fontSize", "Font size")}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={8}
            max={24}
            value={block.fontSize}
            onChange={(e) =>
              onPatchBlock(block.id, { fontSize: Number(e.target.value) })
            }
            className="h-8 w-20 text-xs"
          />
          <span className="text-xs text-muted-foreground">pt</span>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">
          {tx("invoiceDesigner.fontWeight", "Weight")}
        </Label>
        <Select
          value={block.fontWeight}
          onValueChange={(v) =>
            onPatchBlock(block.id, { fontWeight: v as FontWeight })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">
              {tx("invoiceDesigner.weightRegular", "Regular")}
            </SelectItem>
            <SelectItem value="medium">
              {tx("invoiceDesigner.weightMedium", "Medium")}
            </SelectItem>
            <SelectItem value="bold">
              {tx("invoiceDesigner.weightBold", "Bold")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ColorField
        label={tx("invoiceDesigner.textColor", "Text color")}
        value={block.color}
        onChange={(v) => onPatchBlock(block.id, { color: v })}
      />
      <ColorField
        label={tx("invoiceDesigner.background", "Background")}
        value={block.bgColor}
        onChange={(v) => onPatchBlock(block.id, { bgColor: v })}
      />

      <div className="space-y-1">
        <Label className="text-xs">
          {tx("invoiceDesigner.alignment", "Alignment")}
        </Label>
        <div className="flex gap-1">
          {(["left", "center", "right"] as TextAlign[]).map((a) => (
            <Button
              key={a}
              type="button"
              variant={block.align === a ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => onPatchBlock(block.id, { align: a })}
              title={tx(
                `invoiceDesigner.align${a[0].toUpperCase()}${a.slice(1)}`,
                a,
              )}
            >
              {a === "left" && <AlignLeft className="h-3.5 w-3.5" />}
              {a === "center" && <AlignCenter className="h-3.5 w-3.5" />}
              {a === "right" && <AlignRight className="h-3.5 w-3.5" />}
            </Button>
          ))}
        </div>
      </div>

      {extras}

      {(block.id === "header" || block.id === "table" || block.id === "notes") && (
        <LabelOverridePanel
          block={block}
          template={template}
          tx={tx}
          onSetLabel={onSetLabel}
        />
      )}

      {/* baseCurrency hint for currency-aware blocks (totals) */}
      {block.id === "totals" && (
        <p className="text-xs text-muted-foreground">
          {`${baseCurrency} • ${tx(
            "invoiceDesigner.labelsHint",
            "Override default text below.",
          )}`}
        </p>
      )}
    </div>
  );
}

function ColumnToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function LogoControls({
  template,
  logoUrl,
  tx,
  onUpload,
  onRemove,
  onPatch,
}: {
  template: InvoiceTemplate;
  logoUrl: string | null;
  tx: (k: string, fb: string) => string;
  onUpload: (f: File) => void;
  onRemove: () => void;
  onPatch: (p: Partial<InvoiceTemplate>) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">
          {tx("invoiceDesigner.showLogo", "Show logo")}
        </Label>
        <Switch
          checked={template.showLogo}
          onCheckedChange={(v) => onPatch({ showLogo: v })}
        />
      </div>
      {template.showLogo && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">
              {tx("invoiceDesigner.logoPosition", "Logo position")}
            </Label>
            <Select
              value={template.logoPosition}
              onValueChange={(v) =>
                onPatch({ logoPosition: v as LogoPosition })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">
                  {tx("invoiceDesigner.logoLeft", "Left")}
                </SelectItem>
                <SelectItem value="right">
                  {tx("invoiceDesigner.logoRight", "Right")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
          <div className="flex items-center gap-2 rounded-md border bg-background p-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="logo"
                className="h-10 max-w-[120px] object-contain"
              />
            ) : (
              <span className="flex-1 text-xs text-muted-foreground">
                {tx("customFields.noFile", "No file uploaded")}
              </span>
            )}
            <div className="ml-auto flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {tx("invoiceDesigner.logoUpload", "Upload")}
              </Button>
              {logoUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={onRemove}
                >
                  <XIcon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LabelOverridePanel({
  block,
  template,
  tx,
  onSetLabel,
}: {
  block: Block;
  template: InvoiceTemplate;
  tx: (k: string, fb: string) => string;
  onSetLabel: (k: LabelKey, v: string) => void;
}) {
  // Pick a few label keys relevant to the selected block.
  const keys: { key: LabelKey; label: string }[] = (() => {
    if (block.id === "header") {
      return [
        { key: "invoice", label: tx("invoiceDesigner.blocks.header", "Header title") },
        { key: "invoiceNumber", label: tx("invoices.number", "Invoice no.") },
        { key: "issueDate", label: tx("invoices.issueDate", "Issue date") },
        { key: "dueDate", label: tx("invoices.dueDate", "Due date") },
      ];
    }
    if (block.id === "table") {
      return [
        { key: "description", label: tx("invoices.description", "Description") },
        { key: "qty", label: tx("invoices.quantity", "Qty") },
        { key: "unitPrice", label: tx("invoices.unitPrice", "Unit price") },
        { key: "taxRate", label: tx("invoices.taxRate", "Tax %") },
        { key: "discount", label: tx("invoices.discount", "Discount") },
        { key: "lineTotal", label: tx("invoices.lineTotal", "Total") },
      ];
    }
    if (block.id === "notes") {
      return [{ key: "notes", label: tx("invoices.notes", "Notes") }];
    }
    return [];
  })();

  if (keys.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label className="text-xs">
        {tx("invoiceDesigner.labelsHeading", "Custom labels")}
      </Label>
      <p className="text-xs text-muted-foreground">
        {tx(
          "invoiceDesigner.labelsHint",
          "Override default text on the PDF.",
        )}
      </p>
      <div className="space-y-1.5">
        {keys.map(({ key, label }) => (
          <div key={key} className="grid grid-cols-[100px_1fr] items-center gap-2">
            <span className="truncate text-[11px] text-muted-foreground">
              {label}
            </span>
            <Input
              value={template.labels[key] ?? ""}
              placeholder={label}
              onChange={(e) => onSetLabel(key, e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 font-mono text-xs uppercase"
          maxLength={7}
        />
      </div>
    </div>
  );
}
