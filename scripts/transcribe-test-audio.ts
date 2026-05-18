import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { transcribeAudioFile } from "../src/lib/server/openai-transcription";

config({ path: ".env.local" });

const defaultAudioPath = path.join(
  process.cwd(),
  "docs/test-audio/Leo Lesson_20260424_1200.central-15m.m4a",
);

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

async function main() {
  const audioPath = path.resolve(getArgValue("audio") ?? defaultAudioPath);
  const model = getArgValue("model");
  const outputDir = path.join(process.cwd(), "docs/test-audio");
  const basename = path.basename(audioPath).replace(/\.[^.]+$/, "");
  const jsonOutputPath = path.join(outputDir, `${basename}.transcript.json`);
  const textOutputPath = path.join(outputDir, `${basename}.transcript.txt`);

  console.log(`Transcribing ${audioPath}`);
  const result = await transcribeAudioFile({ filePath: audioPath, model });

  await mkdir(outputDir, { recursive: true });
  await writeFile(
    jsonOutputPath,
    `${JSON.stringify(
      {
        audioPath,
        model: result.model,
        durationMs: result.durationMs,
        characterCount: result.text.length,
        text: result.text,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(textOutputPath, `${result.text}\n`);

  console.log(`Model: ${result.model}`);
  console.log(`Characters: ${result.text.length}`);
  console.log(`Duration: ${Math.round(result.durationMs / 1000)}s`);
  console.log(`Wrote ${jsonOutputPath}`);
  console.log(`Wrote ${textOutputPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
