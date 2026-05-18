import { getPracticeLoopReadModel } from "@/lib/data/read-model";
import { ArchiveScreen } from "./archive-screen";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const data = await getPracticeLoopReadModel();
  return <ArchiveScreen data={data} />;
}
