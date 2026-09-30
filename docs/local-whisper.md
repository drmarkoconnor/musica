# Local Whisper on the Mac

The live Netlify app uses OpenAI. It cannot run software installed on your Mac.
Whisper is optional and does not block uploading or analysing lessons online.

## Normal use after setup

1. Record in iPhone Voice Memos and AirDrop the M4A to the Mac.
2. Open the Mac version of Practice Loop and upload the file normally.
3. Select **Analyse lesson**. When the engine and model are installed, the app
   chooses **Whisper on this Mac** automatically. OpenAI remains an explicit
   alternative in the same dialog.
4. Keep the Mac awake and the app server running. Saved passages survive retries.
5. Search the transcript, replay its timed passages and keep useful memories.

There is no manual transcription command for each lesson. The app converts
temporary audio, runs Whisper and removes those temporary files. It never
changes the original upload or the recording on the phone. A failed local run
does not silently upload audio to a paid transcription service.

Whisper transcribes speech. It is not being asked to translate everything into
English. Its multilingual model is used rather than an English-only `.en` model.
English/Italian code-switching, musical terms and speech over piano need human
checking. Music and silence can produce invented words. Timings are speech
estimates, not a guarantee of exact word boundaries. Replay is the authority.

## One-time setup

On 30 September this Intel Mac did not have a working `whisper-cli`. Homebrew
reported incomplete Command Line Tools (the selected developer folder lacks
`xcrun`), and its current Whisper formula had no compatible prebuilt bottle.
Local transcription has therefore **not** been benchmarked or quality-verified
on this machine. The application integration and JSON/timing validation are
tested separately with synthetic fixtures.

First repair/install Apple's tools in Terminal:

```bash
xcode-select --install
```

After the installation finishes, from the project directory:

```bash
brew install whisper.cpp
mkdir -p .local/whisper
curl -L --fail --retry 3 \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin \
  -o .local/whisper/ggml-small-q5_1.bin
npm run dev -- --port 3001
```

Use `http://localhost:3001/lessons`. `.local/` is ignored by Git. The quantised
multilingual small model is a starting point, not a promise that it is the best
model for this Intel Mac. Compare a short real lesson sample before an hour-long
run. Larger models may improve recognition but can be substantially slower.

The app discovers `whisper-cli` in PATH and common Homebrew locations. For a
different installation or model, configure `WHISPER_CLI_PATH` and
`WHISPER_MODEL_PATH` in the existing local environment. Set
`PRACTICE_LOOP_TRANSCRIPTION_PROVIDER=openai` to prefer cloud transcription.

## Optional CLI experiment

To try a recording outside the app after setup:

```bash
ffmpeg -i "/path/to/lesson.m4a" -ar 16000 -ac 1 -c:a pcm_s16le \
  .local/whisper/lesson.wav
whisper-cli -m .local/whisper/ggml-small-q5_1.bin \
  -f .local/whisper/lesson.wav -l auto -oj \
  -of .local/whisper/lesson-transcript -ng
```

`-ng` uses CPU-only inference on this Intel Mac. The JSON transcript stays in
`.local/whisper/`. This experiment does not automatically import that JSON into
the app; the integrated Analyse lesson action is the normal saved workflow.

## Privacy and cost

Local speech-to-text has no API fee, but uses this Mac's processor, electricity
and time. Upload storage/metadata retain the app's existing storage choices:
local Whisper does not make the whole application offline or local-only.
Learning-point extraction still sends the **text transcript** to OpenAI and is
paid. The UI reports a lightweight USD list-price estimate for saved results,
not a billing ledger or an assurance about failed/retried calls.

References: [Whisper.cpp](https://github.com/ggml-org/whisper.cpp),
[official model downloads](https://huggingface.co/ggerganov/whisper.cpp/tree/main),
[OpenAI file transcription](https://developers.openai.com/api/docs/guides/speech-to-text).
