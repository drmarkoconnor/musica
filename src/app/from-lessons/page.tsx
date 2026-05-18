import { getPracticeLoopReadModel } from "@/lib/data/read-model";
import { FromLessonsScreen } from "./from-lessons-screen";

export const dynamic = "force-dynamic";

export default async function FromLessonsPage() {
  const data = await getPracticeLoopReadModel();
  return <FromLessonsScreen data={data} />;
}
