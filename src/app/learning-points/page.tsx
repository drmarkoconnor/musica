import { getPracticeLoopReadModel } from "@/lib/data/read-model";
import { LearningPointsScreen } from "./learning-points-screen";

export const dynamic = "force-dynamic";

export default async function LearningPointsPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const [data, params] = await Promise.all([getPracticeLoopReadModel(), searchParams]);
  return <LearningPointsScreen data={data} initialLessonId={params.lesson ?? ""} />;
}
