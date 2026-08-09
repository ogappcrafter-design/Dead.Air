const { CALL_TYPES } = require('./bands');

/**
 * The response schema handed to the Messages API as a structured output.
 *
 * Type-specific fields are optional here rather than modelled as a five-way
 * anyOf: the client clamps and back-fills every field anyway (see
 * src/engine/generation.js), and a flat schema is far less likely to trip the
 * structured-output compiler. Note the API's JSON Schema subset rejects
 * numeric range keywords, so all bounds live in the prose and the clamps.
 */
const CALL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['callerName', 'callerId', 'signal', 'type', 'lines', 'staticReward', 'sanityDelta'],
  properties: {
    callerName: { type: 'string', description: 'Short all-caps caller label, e.g. HAROLD or THE LOOP.' },
    callerId: { type: 'string', description: 'Short caller ID line, e.g. 555-0891, PRIVATE, or REDACTED.' },
    signal: { type: 'integer', description: 'Signal strength, 0 to 5.' },
    type: { type: 'string', enum: CALL_TYPES },
    lines: {
      type: 'array',
      items: { type: 'string' },
      description:
        'The transmission, one short line at a time. A line starting with a double quote is spoken by the caller; anything else is narration. Use "..." on its own for a beat of silence. 5 to 15 lines.',
    },
    staticReward: { type: 'integer', description: 'Static payout, 30 to 250.' },
    sanityDelta: { type: 'integer', description: 'Sanity change, -30 to 30. Negative unsettles, positive comforts.' },
    waitSeconds: { type: 'integer', description: 'DEAD_AIR only: seconds of held line, 8 to 18.' },
    duration: { type: 'integer', description: 'STAY_CALM only: seconds to endure, 10 to 16.' },
    sanityPenalty: { type: 'integer', description: 'STAY_CALM only: sanity lost on failure, 15 to 25.' },
    choices: {
      type: 'array',
      description: 'RIGHT_ANSWER only: exactly three ways the DJ can respond.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'outcome', 'sanityDelta', 'staticMult'],
        properties: {
          text: { type: 'string', description: 'What the DJ says. Short — this is a button label.' },
          outcome: { type: 'string', description: 'One or two sentences on what happens next.' },
          sanityDelta: { type: 'integer', description: 'Sanity change, -30 to 30.' },
          staticMult: { type: 'number', description: 'Payout multiplier, 0.5 to 3.' },
        },
      },
    },
    intro: { type: 'string', description: 'SIGNAL_DECODE only: one line setting up the sequence.' },
    sequence: {
      type: 'array',
      items: { type: 'integer' },
      description: 'SIGNAL_DECODE only: exactly five integers, each 0 to 4.',
    },
    decodedMessage: {
      type: 'string',
      description: 'SIGNAL_DECODE only: the short all-caps message the sequence spells out.',
    },
  },
};

const SYSTEM_PROMPT = [
  'You write transmissions for DEAD AIR RADIO, an atmospheric horror game about a late-night DJ',
  'who takes calls from the dead, the classified, the looped, and things with no name.',
  '',
  'What makes a call land:',
  '- One specific person with one specific problem. Never a generic ghost.',
  '- The horror is in what is implied and what goes unsaid. No gore, no jump scares, no explanation.',
  '- Short lines. Each one is read alone on a phone screen, a couple of seconds apart.',
  '- The last line should reframe everything before it, or simply stop.',
  '- Grief is the engine. Even the frightening calls are about someone who wanted to be heard.',
].join('\n');

function buildUserPrompt(band, recentNames = []) {
  const avoid = recentNames.filter(Boolean).join(', ');
  return [
    `BAND: ${band.name}`,
    `VIBE: ${band.vibe}`,
    avoid ? `Do not reuse or echo these callers: ${avoid}` : '',
    '',
    'Write one original call for this band. Choose whichever call type suits it:',
    '  JUST_LISTEN    the call simply plays out',
    '  DEAD_AIR       the DJ holds a near-silent line (set waitSeconds)',
    '  RIGHT_ANSWER   what the DJ says changes the ending (set three choices)',
    '  SIGNAL_DECODE  the caller transmits a five-glyph code (set intro, sequence, decodedMessage)',
    '  STAY_CALM      the DJ has to keep their nerve (set duration and sanityPenalty)',
    '',
    'Include only the fields that belong to the type you chose.',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

module.exports = { CALL_SCHEMA, SYSTEM_PROMPT, buildUserPrompt };
