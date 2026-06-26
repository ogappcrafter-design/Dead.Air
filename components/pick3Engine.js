// Ohio Pick 3 Prediction Engine
// Combines: Hot/Cold Frequency, Root Sum Analysis, V-Tracs,
// Rundown Method, Pairs Frequency, Positional Overdue

// V-Trac mapping: digits 0..9 -> vtrac 1..5
const V = [1,2,3,4,5,1,2,3,4,5];
export const toVtrac = d => V[d];

export function rootSum(digits) {
  const s = digits[0] + digits[1] + digits[2];
  if (s === 0) return 9;
  return s % 9 === 0 ? 9 : s % 9;
}

export function fmtDigits(digits) {
  return digits.join('-');
}

function freqByPosition(draws) {
  const f = [new Array(10).fill(0), new Array(10).fill(0), new Array(10).fill(0)];
  for (const d of draws) d.digits.forEach((v, i) => f[i][v]++);
  return f;
}

function vtracPatternFreq(draws) {
  const counts = {};
  for (const d of draws) {
    const key = d.digits.map(toVtrac).join('');
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function pairFreq(draws) {
  const counts = {};
  for (const d of draws) {
    const [a, b, c] = d.digits;
    const ps = [
      `${Math.min(a,b)}${Math.max(a,b)}`,
      `${Math.min(a,c)}${Math.max(a,c)}`,
      `${Math.min(b,c)}${Math.max(b,c)}`,
    ];
    for (const p of ps) counts[p] = (counts[p] || 0) + 1;
  }
  return counts;
}

function rootSumOverdue(draws) {
  const last = new Array(10).fill(Infinity);
  for (let i = draws.length - 1; i >= 0; i--) {
    const rs = rootSum(draws[i].digits);
    if (last[rs] === Infinity) last[rs] = draws.length - 1 - i;
  }
  return last; // draws since each root sum last appeared
}

function positionalOverdue(draws) {
  const last = [
    new Array(10).fill(Infinity),
    new Array(10).fill(Infinity),
    new Array(10).fill(Infinity),
  ];
  for (let i = draws.length - 1; i >= 0; i--) {
    draws[i].digits.forEach((d, pos) => {
      if (last[pos][d] === Infinity) last[pos][d] = draws.length - 1 - i;
    });
  }
  return last;
}

function rundownSteps(draws, steps = 9) {
  if (!draws.length) return [];
  const result = [];
  let cur = [...draws[draws.length - 1].digits];
  for (let i = 0; i < steps; i++) {
    cur = cur.map(d => (d + 1) % 10);
    result.push([...cur]);
  }
  return result;
}

// Seeded RNG (Mulberry32)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function methodContribution(digits, { hot3, rsRanked, topVtrac, topPairs, rdCandidates, overdue3 }) {
  const [a, b, c] = digits;
  const rs = rootSum([a,b,c]);
  const vp = [a,b,c].map(toVtrac).join('');
  const combPairs = [
    `${Math.min(a,b)}${Math.max(a,b)}`,
    `${Math.min(a,c)}${Math.max(a,c)}`,
    `${Math.min(b,c)}${Math.max(b,c)}`,
  ];

  return {
    hotDigits: [hot3[0].includes(a), hot3[1].includes(b), hot3[2].includes(c)].filter(Boolean).length,
    rootSum:   { value: rs, rank: rsRanked.indexOf(rs) },
    vtrac:     topVtrac.slice(0,5).includes(vp),
    vtracPat:  vp.split('').map(n => `V${n}`).join('-'),
    pairs:     combPairs.filter(p => topPairs.includes(p)).length,
    rundown:   rdCandidates.findIndex(([ra,rb,rc]) => ra===a && rb===b && rc===c),
    overdue:   [overdue3[0].includes(a), overdue3[1].includes(b), overdue3[2].includes(c)].filter(Boolean).length,
  };
}

export function generatePredictions(draws, genSeed = 0) {
  if (draws.length < 5) return null;

  const recent = draws.slice(-40); // cap at 40 draws for analysis window
  const n = recent.length;

  // --- Analysis signals ---
  const freq     = freqByPosition(recent);
  const vpat     = vtracPatternFreq(recent);
  const pairs    = pairFreq(recent);
  const rsLast   = rootSumOverdue(recent);
  const posOver  = positionalOverdue(recent);
  const rdCandidates = rundownSteps(recent);

  const topVtrac = Object.entries(vpat).sort((a,b) => b[1]-a[1]).map(([k]) => k);
  const topPairs = Object.entries(pairs).sort((a,b) => b[1]-a[1]).slice(0,10).map(([k]) => k);
  const rsRanked = rsLast.map((v,i) => ({rs:i,v})).sort((a,b) => b.v-a.v).map(x => x.rs);

  // Hot top-3 per position
  const hot3 = freq.map(f =>
    f.map((c,d) => ({d,c})).sort((a,b) => b.c-a.c).slice(0,3).map(x => x.d)
  );

  // Overdue top-3 per position
  const overdue3 = posOver.map(arr =>
    arr.map((v,d) => ({d,v})).sort((a,b) => b.v-a.v).slice(0,3).map(x => x.d)
  );

  // --- Score all 1000 combinations ---
  const scored = [];
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      for (let c = 0; c <= 9; c++) {
        let score = 0;

        // 1. Hot digits per position (max +18)
        [a,b,c].forEach((d, i) => {
          const rank = hot3[i].indexOf(d);
          if (rank !== -1) score += (3 - rank) * 3;
        });

        // 2. Root sum overdue rank (max +10)
        const rs = rootSum([a,b,c]);
        const rsRank = rsRanked.indexOf(rs);
        if (rsRank < 5) score += (5 - rsRank) * 2;

        // 3. V-Trac pattern match (max +10)
        const vp = [a,b,c].map(toVtrac).join('');
        const viRank = topVtrac.indexOf(vp);
        if (viRank < 5) score += (5 - viRank) * 2;

        // 4. Pairs frequency (max +9)
        const combPairs = [
          `${Math.min(a,b)}${Math.max(a,b)}`,
          `${Math.min(a,c)}${Math.max(a,c)}`,
          `${Math.min(b,c)}${Math.max(b,c)}`,
        ];
        for (const p of combPairs) {
          const pRank = topPairs.indexOf(p);
          if (pRank !== -1) score += Math.max(1, 4 - Math.floor(pRank / 2));
        }

        // 5. Rundown candidate (max +6)
        const rdIdx = rdCandidates.findIndex(([ra,rb,rc]) => ra===a && rb===b && rc===c);
        if (rdIdx !== -1) score += Math.max(1, 6 - rdIdx);

        // 6. Positional overdue (max +9)
        [a,b,c].forEach((d, i) => {
          const rank = overdue3[i].indexOf(d);
          if (rank !== -1) score += (3 - rank);
        });

        scored.push({ digits: [a,b,c], score });
      }
    }
  }

  scored.sort((a,b) => b.score - a.score);

  const maxScore = scored[0].score;
  const signals = { hot3, rsRanked, topVtrac, topPairs, rdCandidates, overdue3 };

  // Pick primary and alt using seeded randomness from top 20
  const pool = scored.slice(0, 20);
  const rand = rng(genSeed + 1);

  // Weighted selection: higher score = higher probability
  const weights = pool.map(x => x.score);
  const total = weights.reduce((a,b) => a+b, 0);
  let pick = rand() * total;
  let primaryIdx = 0;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i];
    if (pick <= 0) { primaryIdx = i; break; }
  }
  const primary = pool[primaryIdx];

  // Alt: pick differently from remaining top 10
  const altPool = pool.filter((_, i) => i !== primaryIdx).slice(0, 10);
  const altWeights = altPool.map(x => x.score);
  const altTotal = altWeights.reduce((a,b) => a+b, 0);
  let altPick = rand() * altTotal;
  let altIdx = 0;
  for (let i = 0; i < altWeights.length; i++) {
    altPick -= altWeights[i];
    if (altPick <= 0) { altIdx = i; break; }
  }
  const alt = altPool[altIdx];

  const confidence = Math.round((primary.score / maxScore) * 100);

  return {
    primary,
    alt,
    confidence,
    methods: methodContribution(primary.digits, signals),
    drawnFrom: n,
  };
}
