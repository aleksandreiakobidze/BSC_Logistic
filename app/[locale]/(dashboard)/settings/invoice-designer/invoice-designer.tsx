"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw } from "lucide-react";
import { saveInvoiceTemplate } from "../actions";
import { DEFAULT_TEMPLATE } from "@/lib/invoice-template";
import type { Block, BlockId, InvoiceTemplate } from "@/lib/invoice-template";
import { BlockList } from "./block-list";
import { StylePanel } from "./style-panel";
import { PreviewInvoice } from "./preview-invoice";

interface InvoiceDesignerProps {
  initialTemplate: InvoiceTemplate;
  orgName: string;
}

export function InvoiceDesigner({ initialTemplate, orgName }: InvoiceDesignerProps) {
  const [template, setTemplate] = useState<InvoiceTemplate>(initialTemplate);
  const [selectedId, setSelectedId] = useState<BlockId | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateBlock(id: BlockId, patch: Partial<Block>) {
    setTemplate((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }

  function toggleVisible(id: BlockId) {
    setTemplate((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) =>
        b.id === id ? { ...b, visible: !b.visible } : b,
      ),
    }));
  }

  function reorderBlocks(blocks: Block[]) {
    setTemplate((prev) => ({ ...prev, blocks }));
  }

  function updateGlobal(patch: Partial<InvoiceTemplate>) {
    setTemplate((prev) => ({ ...prev, ...patch }));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveInvoiceTemplate(template);
        toast.success("Invoice template saved.");
      } catch {
        toast.error("Failed to save template.");
      }
    });
  }

  function handleReset() {
    setTemplate(DEFAULT_TEMPLATE);
    setSelectedId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-1">
          <RotateCcw className="h-4 w-4" />
          Reset to default
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-1">
          <Save className="h-4 w-4" />
          {isPending ? "Saving…" : "Save template"}
        </Button>
      </div>

      {/* Three-panel layout */}
      <div className="grid grid-cols-[220px_1fr_240px] gap-4 rounded-xl border bg-card overflow-hidden" style={{ minHeight: "75vh" }}>
        {/* Left — Block list */}
        <div className="flex flex-col border-r">
          <div className="border-b px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Blocks</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <BlockList
              blocks={template.blocks}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggleVisible={toggleVisible}
              onReorder={reorderBlocks}
            />
          </div>
        </div>

        {/* Center — Live preview */}
        <div className="flex flex-col bg-muted/30">
          <div className="border-b px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Live Preview
            </p>
          </div>
          <div className="flex-1 overflow-auto">
            <PreviewInvoice template={template} orgName={orgName} />
          </div>
        </div>

        {/* Right — Style panel */}
        <div className="flex flex-col border-l">
          <div className="border-b px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Style</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <StylePanel
              template={template}
              selectedId={selectedId}
              onUpdateBlock={updateBlock}
              onUpdateGlobal={updateGlobal}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
