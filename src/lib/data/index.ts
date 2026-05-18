import { createNeonPracticeLoopRepository } from "./neon-repository";
import { mockPracticeLoopRepository } from "./mock-repository";
import type {
  PracticeLoopDataSource,
  PracticeLoopRepository,
} from "./practice-loop-repository";

export function createPracticeLoopRepository(
  dataSource = process.env.PRACTICE_LOOP_DATA_SOURCE,
): PracticeLoopRepository {
  const resolvedDataSource: PracticeLoopDataSource =
    dataSource === "neon" ? "neon" : "mock";

  if (resolvedDataSource === "neon") {
    return createNeonPracticeLoopRepository();
  }

  return mockPracticeLoopRepository;
}

export type {
  PracticeLoopDataSource,
  PracticeLoopReadModel,
  PracticeLoopRepository,
} from "./practice-loop-repository";
export { mockPracticeLoopRepository } from "./mock-repository";
