export const TEST_LESSON_FIXTURE_ID = "leo-20260424-central-15";
export const TEST_LESSON_FIXTURE_STORAGE_PATH =
  "docs/test-audio/Leo Lesson_20260424_1200.central-15m.m4a";
export const TEST_LESSON_FIXTURE_ORIGINAL_OFFSET_SECONDS = 20 * 60 + 31;

export type TeachingTranscriptBullet = {
  id: string;
  startsAtSeconds: number;
  endsAtSeconds: number;
  title: string;
  body: string;
  suggestedPracticeNote?: string;
};

export const teachingTranscriptBullets: TeachingTranscriptBullet[] = [
  {
    id: "social-performance-chat",
    startsAtSeconds: 0,
    endsAtSeconds: 245,
    title: "Social chat before teaching starts",
    body: "Conversation about a live performance, nerves, audience response, and songwriting progress. Useful memory context, but not a practice task.",
  },
  {
    id: "bass-melody-pattern",
    startsAtSeconds: 245,
    endsAtSeconds: 315,
    title: "Bass and melody are becoming easier to remember",
    body: "Mark notices that two hands together can make the bass-and-melody pattern easier to remember, and asks whether the current tempo is useful.",
    suggestedPracticeNote: "Review bass and melody slowly enough to see the pattern.",
  },
  {
    id: "repeat-and-catch-mistake",
    startsAtSeconds: 315,
    endsAtSeconds: 385,
    title: "Repeat the passage and catch the recurring mistake",
    body: "Leo says most chords were right and asks for another pass, stopping only if the same mistake appears again.",
    suggestedPracticeNote: "Repeat the passage and listen for the same mistake before stopping.",
  },
  {
    id: "thirds-sevenths-before-tensions",
    startsAtSeconds: 385,
    endsAtSeconds: 505,
    title: "Prioritise third and seventh before tension notes",
    body: "In the D9/B9 area, Leo redirects attention away from added tensions and back to the third and seventh.",
    suggestedPracticeNote: "Check thirds and sevenths before adding 9ths or 13ths.",
  },
  {
    id: "bass-note-correction",
    startsAtSeconds: 505,
    endsAtSeconds: 590,
    title: "Correct the bass note that was making the chord sound wrong",
    body: "Mark identifies that an A in the bass was causing the harmony to sound off, then compares the corrected sound with the ninth added.",
    suggestedPracticeNote: "When a chord sounds wrong, check the bass note first.",
  },
  {
    id: "dominant-extensions-need-seventh",
    startsAtSeconds: 590,
    endsAtSeconds: 705,
    title: "9, 11, and 13 imply a dominant chord underneath",
    body: "Leo explains that when a symbol is above seven, such as 9, 11, or 13, the underlying chord is dominant and needs the seventh.",
    suggestedPracticeNote: "For 9/11/13 chords, name and play the dominant seventh.",
  },
  {
    id: "harmony-before-melody-after-rest",
    startsAtSeconds: 705,
    endsAtSeconds: 900,
    title: "Use the first-beat rest to place harmony before melody",
    body: "Leo suggests playing the harmony on the first beat where the melody rests, then bringing the melody in on the second beat. The section moves through E major seven and C sharp minor correction.",
    suggestedPracticeNote: "Use melody rests to place harmony clearly before the line.",
  },
];

export function originalLessonSeconds(fixtureSeconds: number) {
  return TEST_LESSON_FIXTURE_ORIGINAL_OFFSET_SECONDS + fixtureSeconds;
}
