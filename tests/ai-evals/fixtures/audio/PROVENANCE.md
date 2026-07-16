# Synthetic speech fixture provenance

Both clips are synthetic test assets generated locally from the exact text recorded in `speech-golden.json`. No network voice service, external recording, production data, user content, or real employee data was used. No real employee data is represented in either transcript or waveform.

Generation used the macOS `Majed` Arabic system text-to-speech voice at 150 words per minute, followed by a deterministic conversion to mono 16 kHz 16-bit PCM WAV with metadata removed. The files are project test fixtures; no source recording is redistributed.

Phase 0 validates corpus integrity only. It verifies presence, WAV structure, manifest registration, provenance, privacy classification, numeric tolerance, golden transcript, and SHA-256. Full speech-to-text quality execution is reserved for T032 and T044.

## `speech-gulf-synthetic`

- Dialect label: Gulf
- Synthetic input: `هلا، هذا تسجيل خليجي اصطناعي لاختبار سلامة ملف الصوت.`
- SHA-256: `1886b334ec6116da84bccb63a82db0188b54fa23d4504d6b3228f2c40db6012e`
- Expected disposition: `integrity_only`

## `speech-levantine-synthetic`

- Dialect label: Levantine
- Synthetic input: `مرحبا، هيدا تسجيل شامي اصطناعي لفحص سلامة ملف الصوت.`
- SHA-256: `18c7162de17b6e548f3552d9f03282bc5b407b1eeee83621ea76dcdb5574a624`
- Expected disposition: `integrity_only`
