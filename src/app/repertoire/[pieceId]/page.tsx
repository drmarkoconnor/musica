import { getPracticeLoopReadModel } from "@/lib/data/read-model";
import { PieceDetailScreen } from "./piece-detail-screen";

export const dynamic = "force-dynamic";

export default async function PieceDetailPage({
  params,
}: {
  params: Promise<{ pieceId: string }>;
}) {
  const [{ pieceId }, data] = await Promise.all([
    params,
    getPracticeLoopReadModel(),
  ]);

  return <PieceDetailScreen data={data} pieceId={pieceId} />;
}
