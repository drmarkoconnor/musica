import { getPracticeLoopReadModel } from "@/lib/data/read-model";
import { LessonsScreen } from "./lessons-screen";

export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  const data = await getPracticeLoopReadModel();
  return <LessonsScreen data={data} />;
}
