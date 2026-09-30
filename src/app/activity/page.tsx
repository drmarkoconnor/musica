import { getPracticeLoopReadModel } from "@/lib/data/read-model";
import { DashboardScreen } from "../dashboard-screen";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  return <DashboardScreen data={await getPracticeLoopReadModel()} />;
}
