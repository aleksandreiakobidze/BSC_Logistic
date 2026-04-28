"use client";

import { useTranslations } from "next-intl";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Entity =
  | "shipments"
  | "orders"
  | "invoices"
  | "expenses"
  | "drivers"
  | "vehicles"
  | "customers"
  | "contacts"
  | "leads";

export function ExportButton({ entity }: { entity: Entity }) {
  const t = useTranslations("common");

  const base = `/api/export/${entity}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          {t("export")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={`${base}?fmt=xlsx`} download>
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
            {t("exportExcel")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${base}?fmt=csv`} download>
            <FileText className="mr-2 h-4 w-4 text-blue-600" />
            {t("exportCsv")}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
