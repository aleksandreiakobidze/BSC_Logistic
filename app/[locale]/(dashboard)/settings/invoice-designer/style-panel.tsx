"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AlignLeft, AlignCenter, AlignRight, Bold } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Block,
  BlockId,
  InvoiceTemplate,
  FontFamily,
  PageSize,
  LogoPosition,
  TextAlign,
  FontWeight,
} from "@/lib/invoice-template";

interface StylePanelProps {
  template: InvoiceTemplate;
  selectedId: BlockId | null;
  onUpdateBlock: (id: BlockId, patch: Partial<Block>) => void;
  onUpdateGlobal: (patch: Partial<InvoiceTemplate>) => void;
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

export function StylePanel({
  template,
  selectedId,
  onUpdateBlock,
  onUpdateGlobal,
}: StylePanelProps) {
  const block = selectedId
    ? template.blocks.find((b) => b.id === selectedId)
    : null;

  return (
    <div className="space-y-5 overflow-y-auto">
      {/* Global settings */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Global
        </p>

        <ColorField
          label="Primary color"
          value={template.primaryColor}
          onChange={(v) => onUpdateGlobal({ primaryColor: v })}
        />
        <ColorField
          label="Accent color"
          value={template.accentColor}
          onChange={(v) => onUpdateGlobal({ accentColor: v })}
        />

        <div className="space-y-1">
          <Label className="text-xs">Font family</Label>
          <Select
            value={template.fontFamily}
            onValueChange={(v) => onUpdateGlobal({ fontFamily: v as FontFamily })}
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
          <Label className="text-xs">Page size</Label>
          <Select
            value={template.pageSize}
            onValueChange={(v) => onUpdateGlobal({ pageSize: v as PageSize })}
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

        <div className="flex items-center justify-between">
          <Label className="text-xs">Show logo</Label>
          <Switch
            checked={template.showLogo}
            onCheckedChange={(v) => onUpdateGlobal({ showLogo: v })}
          />
        </div>

        {template.showLogo && (
          <div className="space-y-1">
            <Label className="text-xs">Logo position</Label>
            <Select
              value={template.logoPosition}
              onValueChange={(v) =>
                onUpdateGlobal({ logoPosition: v as LogoPosition })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Footer text</Label>
          <Input
            value={template.footerText}
            onChange={(e) => onUpdateGlobal({ footerText: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {block && (
        <>
          <Separator />
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {block.label}
            </p>

            <div className="space-y-1">
              <Label className="text-xs">Font size</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={6}
                  max={48}
                  value={block.fontSize}
                  onChange={(e) =>
                    onUpdateBlock(block.id, { fontSize: Number(e.target.value) })
                  }
                  className="h-8 w-20 text-xs"
                />
                <span className="text-xs text-muted-foreground">pt</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Weight</Label>
              <Button
                type="button"
                variant={block.fontWeight === "bold" ? "default" : "outline"}
                size="sm"
                className="h-8 w-full gap-1 text-xs"
                onClick={() =>
                  onUpdateBlock(block.id, {
                    fontWeight:
                      block.fontWeight === "bold"
                        ? "normal"
                        : ("bold" as FontWeight),
                  })
                }
              >
                <Bold className="h-3 w-3" /> Bold
              </Button>
            </div>

            <ColorField
              label="Text color"
              value={block.color}
              onChange={(v) => onUpdateBlock(block.id, { color: v })}
            />
            <ColorField
              label="Background"
              value={block.bgColor}
              onChange={(v) => onUpdateBlock(block.id, { bgColor: v })}
            />

            <div className="space-y-1">
              <Label className="text-xs">Alignment</Label>
              <div className="flex gap-1">
                {(["left", "center", "right"] as TextAlign[]).map((a) => (
                  <Button
                    key={a}
                    type="button"
                    variant={block.align === a ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onUpdateBlock(block.id, { align: a })}
                  >
                    {a === "left" && <AlignLeft className="h-3 w-3" />}
                    {a === "center" && <AlignCenter className="h-3 w-3" />}
                    {a === "right" && <AlignRight className="h-3 w-3" />}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {!block && (
        <p className="text-xs text-muted-foreground italic">
          Click a block on the left to edit its styles.
        </p>
      )}
    </div>
  );
}
