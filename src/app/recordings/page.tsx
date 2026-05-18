import { getPracticeLoopReadModel } from "@/lib/data/read-model";
import { RecordingsScreen } from "./recordings-screen";

export const dynamic = "force-dynamic";

export default async function RecordingsPage() {
  const data = await getPracticeLoopReadModel();
  return <RecordingsScreen data={data} />;
}
