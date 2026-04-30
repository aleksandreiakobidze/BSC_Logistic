import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface AgingBuckets {
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90plus: number;
}

export async function ARSection({
  aging,
  topOutstanding,
  locale,
}: {
  aging: AgingBuckets;
  topOutstanding: { id: string; name: string; amount: number }[];
  locale: string;
}) {
  const t = await getTranslations();

  const buckets = [
    { key: "0_30" as const, label: t("payments.aging.0_30"), value: aging.b0_30, tone: "text-emerald-600 dark:text-emerald-400" },
    { key: "31_60" as const, label: t("payments.aging.31_60"), value: aging.b31_60, tone: "text-amber-600 dark:text-amber-400" },
    { key: "61_90" as const, label: t("payments.aging.61_90"), value: aging.b61_90, tone: "text-orange-600 dark:text-orange-400" },
    { key: "90plus" as const, label: t("payments.aging.90plus"), value: aging.b90plus, tone: "text-rose-600 dark:text-rose-400" },
  ];

  const totalOutstanding = buckets.reduce((acc, b) => acc + b.value, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            {t("reports.arAging")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("reports.arAgingDesc")}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {buckets.map((b) => (
              <div
                key={b.key}
                className="rounded-xl border bg-muted/20 p-3"
              >
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {b.label}
                </div>
                <div className={`mt-1 font-mono text-lg font-semibold ${b.tone}`}>
                  {formatCurrency(b.value, "USD", locale)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground">{t("reports.totalOutstanding")}</span>
            <span className="font-mono font-semibold">
              {formatCurrency(totalOutstanding, "USD", locale)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            {t("reports.topOutstandingCustomers")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("reports.topOutstandingCustomersDesc")}
          </p>
        </CardHeader>
        <CardContent>
          {topOutstanding.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              {t("payments.empty")}
            </div>
          ) : (
            <>
              <ul className="divide-y">
                {topOutstanding.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    <span className="font-mono text-amber-600 dark:text-amber-400">
                      {formatCurrency(c.amount, "USD", locale)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between gap-2 border-t bg-muted/40 px-1 py-2.5 text-sm font-semibold">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t("reports.subtotal")} ·{" "}
                  <span className="font-mono normal-case">
                    {topOutstanding.length}
                  </span>{" "}
                  {t("reports.rows")}
                </span>
                <span className="font-mono">
                  <span className="text-[10px] text-muted-foreground">Σ </span>
                  {formatCurrency(
                    topOutstanding.reduce((acc, c) => acc + c.amount, 0),
                    "USD",
                    locale,
                  )}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
