"use client";

import * as React from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteExpense } from "./actions";

export function DeleteExpenseButton({ id, description }: { id: string; description: string }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function onConfirm() {
    setLoading(true);
    try {
      await deleteExpense(id);
      toast.success("Expense deleted");
      setOpen(false);
    } catch {
      toast.error("Failed to delete expense");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete expense?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">&ldquo;{description}&rdquo;</span> will be permanently deleted and cannot be recovered.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
            className="gap-1.5"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
