import { getPracticeLoopReadModel } from "@/lib/data/read-model";
import { RepertoireScreen } from "./repertoire-screen";

export const dynamic = "force-dynamic";

export default async function RepertoirePage() {
  const data = await getPracticeLoopReadModel();
  return (
    <RepertoireScreen
      data={data}
      isNeon={process.env.PRACTICE_LOOP_DATA_SOURCE === "neon"}
    />
  );
}
