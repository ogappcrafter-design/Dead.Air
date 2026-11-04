// engine/audio/tts/index.ts
// DEA-94 call-voice synthesis barrel.

export {
  phonemize,
  estimateSpeechDurationMs,
  type PhonemeKind,
  type PhonemeSegment,
} from './Phonemizer';
export {
  voiceProfileFor,
  profileHash,
  type VoiceProfile,
  type VoiceProfileOptions,
} from './VoiceProfile';
export { renderSpeech, type RenderedSpeech, type SpeechRenderOptions } from './FormantSynthesizer';
