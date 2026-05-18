import { getPracticeLoopReadModel } from "@/lib/data/read-model";
import { PracticeScreen } from "./practice-screen";

export const dynamic = "force-dynamic";

export default async function PracticePage() {
  const data = await getPracticeLoopReadModel();
  return <PracticeScreen data={data} />;
}
