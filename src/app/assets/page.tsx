import { getPracticeLoopReadModel } from "@/lib/data/read-model";
import { AssetsScreen } from "./assets-screen";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const data = await getPracticeLoopReadModel();
  return <AssetsScreen data={data} />;
}
