import { getPracticeLoopReadModel } from "@/lib/data/read-model";
import { DashboardScreen } from "./dashboard-screen";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getPracticeLoopReadModel();
  return <DashboardScreen data={data} />;
}
