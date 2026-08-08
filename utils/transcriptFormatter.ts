import { BANDS } from '../lib/constants';
import type { CallData } from '../engine/calls/types';

export interface TranscriptLine {
  speaker: string;
  text: string;
}

export interface TranscriptData {
  stationName: string;
  djCallSign: string;
  bandName: string;
  lines: TranscriptLine[];
  watermark: string;
}

const WATERMARK = 'DEAD AIR RADIO';

function bandName(band: number): string {
  if (band >= 0 && band < BANDS.length) {
    return BANDS[band] ?? 'UNKNOWN';
  }
  return 'UNKNOWN';
}

export function formatTranscript(call: CallData, djCallSign: string): TranscriptData {
  const lines: TranscriptLine[] = [];

  if (call.intro) {
    lines.push({ speaker: 'INTRO', text: call.intro });
  }

  const callLines = call.lines ?? [];
  const speakerMap = call.lineSpeakers ?? [];

  for (let i = 0; i < callLines.length; i++) {
    const text = callLines[i] ?? '';
    const speakerIdx = speakerMap[i];
    if (speakerIdx === 0) {
      lines.push({ speaker: djCallSign, text });
    } else if (speakerIdx === 1) {
      lines.push({ speaker: 'CALLER', text });
    } else {
      lines.push({ speaker: `SPEAKER_${speakerIdx ?? i + 2}`, text });
    }
  }

  if (call.decodedMessage) {
    lines.push({ speaker: 'DECODED', text: call.decodedMessage });
  }

  return {
    stationName: bandName(call.band),
    djCallSign,
    bandName: bandName(call.band),
    lines,
    watermark: WATERMARK,
  };
}

export function transcriptToText(transcript: TranscriptData): string {
  const header = `${transcript.stationName} — ${transcript.djCallSign}`;
  const body = transcript.lines.map((l) => `[${l.speaker}] ${l.text}`).join('\n');
  const footer = `\n— ${transcript.watermark}`;
  return `${header}\n\n${body}${footer}`;
}
