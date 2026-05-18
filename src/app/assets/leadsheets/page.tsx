import { getPracticeLoopReadModel } from "@/lib/data/read-model";
import { scanLeadSheets } from "@/lib/server/lead-sheets";
import { LeadSheetsReviewScreen } from "./lead-sheets-review-screen";

export const dynamic = "force-dynamic";

export default async function LeadSheetsReviewPage() {
  const data = await getPracticeLoopReadModel();
  const suggestions = await scanLeadSheets(data.pieces);

  return <LeadSheetsReviewScreen suggestions={suggestions} />;
}
