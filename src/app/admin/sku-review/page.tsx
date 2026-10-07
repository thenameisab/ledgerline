import { requireCan } from "@/lib/access";
import { StatusBar } from "@/components/StatusBar";
import { ApiReview } from "@/components/apis/ApiReview";
import {
  listApis,
  listUnknownCodes,
  listNoCodeRows,
  listNameDrift,
  listRetiredWithUsage,
} from "@/lib/repos/apis";

export const dynamic = "force-dynamic";

export default async function ApiReviewPage() {
  await requireCan("alias.resolve");
  const [unknownCodes, noCodeRows, drift, retired, targets] = await Promise.all([
    listUnknownCodes(),
    listNoCodeRows(),
    listNameDrift(),
    listRetiredWithUsage(),
    listApis(),
  ]);

  const open = unknownCodes.length + noCodeRows.length + drift.length;

  return (
    <main>
      <StatusBar
        title="SKU review"
        subtitle={
          open === 0
            ? "Every usage row maps to an active catalog code."
            : `${unknownCodes.length} unknown code${unknownCodes.length === 1 ? "" : "s"} · ` +
              `${noCodeRows.length} missing code${noCodeRows.length === 1 ? "" : "s"} · ` +
              `${drift.length} name drift`
        }
      />
      <div className="mx-auto w-full max-w-[1100px] px-7 py-6">
        <ApiReview
          unknownCodes={unknownCodes}
          noCodeRows={noCodeRows}
          drift={drift}
          retired={retired}
          targets={targets.map((t: any) => ({ product_code: t.product_code, name: t.name }))}
        />
      </div>
    </main>
  );
}
