// Ohio Pick 3 Prediction Engine
// Methods: Hot/Cold Frequency · Root Sum · V-Tracs · Rundown · Pairs · Positional Overdue

const V = [1,2,3,4,5,1,2,3,4,5]; // digit 0-9 → vtrac 1-5
export const toVtrac = d => V[d];

export function rootSum(digits) {
  const s = digits[0] + digits[1] + digits[2];
  if (s === 0) return 9;
  return s % 9 === 0 ? 9 : s % 9;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

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
  return last;
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

// ── Per-digit signal analysis ─────────────────────────────────────────────────

export function analyzeDigitStats(draws, digits, count = 30) {
  const recent = draws.slice(-count);
  const n = recent.length;

  return digits.map((digit, pos) => {
    const freq = recent.filter(d => d.digits[pos] === digit).length;
    const freqPct = n > 0 ? Math.round((freq / n) * 100) : 10;

    // Draws since this digit last appeared in this position
    let overdueCount = n; // assume maximum if never seen
    for (let i = n - 1; i >= 0; i--) {
      if (recent[i].digits[pos] === digit) { overdueCount = n - 1 - i; break; }
    }

    // V-Trac group frequency in this position
    const vt = toVtrac(digit);
    const vtFreq = n > 0 ? recent.filter(d => toVtrac(d.digits[pos]) === vt).length : 0;
    const vtracHot = n > 0 && vtFreq / n > 0.20;

    // Rundown (is this digit a +1 step result for this position?)
    let inRundown = false;
    let rundownStep = -1;
    if (n > 0) {
      const lastDig = recent[n - 1].digits[pos];
      for (let step = 1; step <= 5; step++) {
        if ((lastDig + step) % 10 === digit) { inRundown = true; rundownStep = step; break; }
      }
    }

    // Signal strength: multi-factor score normalized to 0-100
    let sig = freqPct; // base: raw frequency percentage
    if (overdueCount >= 12) sig = Math.max(sig, 12) + 22;
    else if (overdueCount >= 7) sig = Math.max(sig, 8) + 12;
    else if (overdueCount <= 1 && freqPct < 8) sig = Math.max(3, sig - 5); // just hit + cold
    if (vtracHot) sig += 10;
    if (inRundown && rundownStep <= 3) sig += 8;
    sig = Math.min(94, Math.max(4, Math.round(sig)));

    // Label + recommendation
    let label, rec, level;
    if (freqPct >= 17 || (freqPct >= 12 && (vtracHot || (inRundown && rundownStep <= 2)))) {
      label = 'HOT'; rec = 'SOLID PLAY'; level = 'good';
    } else if (overdueCount >= 14) {
      label = 'LONG OVERDUE'; rec = 'HIGH RISK / HIGH REWARD'; level = 'caution';
    } else if (overdueCount >= 8) {
      label = 'OVERDUE'; rec = 'MODERATE PLAY'; level = 'ok';
    } else if (freqPct >= 9) {
      label = 'WARM'; rec = vtracHot ? 'SOLID PLAY' : 'MODERATE PLAY'; level = vtracHot ? 'good' : 'ok';
    } else {
      label = 'COLD'; rec = 'RISKY PICK'; level = 'bad';
    }

    const reasons = [`${freq}/${n} draws (${freqPct}% freq)`];
    if (overdueCount > 0) reasons.push(`${overdueCount} draws since last hit`);
    if (vtracHot) reasons.push(`V${vt} group trending in pos`);
    if (inRundown) reasons.push(`+${rundownStep} rundown match`);

    return { digit, pos, freqPct, sig, freq, n, label, rec, level, overdueCount, vtracHot, inRundown, rundownStep, reason: reasons.join(' · ') };
  });
}

export function overallRec(stats) {
  const good    = stats.filter(d => d.level === 'good').length;
  const bad     = stats.filter(d => d.level === 'bad').length;
  const caution = stats.filter(d => d.level === 'caution').length;

  if (good === 3)              return { text: 'PREMIUM PLAY', level: 'good' };
  if (good >= 2 && bad === 0)  return { text: 'STRONG PLAY',  level: 'good' };
  if (good >= 1 && bad === 0)  return { text: 'SOLID PLAY',   level: 'good' };
  if (bad >= 2)                return { text: 'CONSIDER PASSING',       level: 'bad' };
  if (bad >= 1 && good === 0)  return { text: 'RISKY — PLAY WITH CARE', level: 'bad' };
  if (caution >= 1)            return { text: 'HIGH RISK / HIGH REWARD', level: 'caution' };
  return { text: 'MODERATE PLAY', level: 'ok' };
}

// ── Main prediction scorer ────────────────────────────────────────────────────

export function generatePredictions(draws, genSeed = 0) {
  if (draws.length < 5) return null;

  const recent = draws.slice(-40);
  const n = recent.length;

  const freq        = freqByPosition(recent);
  const vpat        = vtracPatternFreq(recent);
  const pairs       = pairFreq(recent);
  const rsLast      = rootSumOverdue(recent);
  const posOver     = positionalOverdue(recent);
  const rdCandidates = rundownSteps(recent);

  const topVtrac = Object.entries(vpat).sort((a,b) => b[1]-a[1]).map(([k]) => k);
  const topPairs = Object.entries(pairs).sort((a,b) => b[1]-a[1]).slice(0,10).map(([k]) => k);
  const rsRanked = rsLast.map((v,i) => ({rs:i,v})).sort((a,b) => b.v-a.v).map(x => x.rs);

  const hot3 = freq.map(f =>
    f.map((c,d) => ({d,c})).sort((a,b) => b.c-a.c).slice(0,3).map(x => x.d)
  );
  const overdue3 = posOver.map(arr =>
    arr.map((v,d) => ({d,v})).sort((a,b) => b.v-a.v).slice(0,3).map(x => x.d)
  );

  const scored = [];
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      for (let c = 0; c <= 9; c++) {
        let score = 0;
        [a,b,c].forEach((d, i) => {
          const rank = hot3[i].indexOf(d);
          if (rank !== -1) score += (3 - rank) * 3;
        });
        const rs = rootSum([a,b,c]);
        const rsRank = rsRanked.indexOf(rs);
        if (rsRank < 5) score += (5 - rsRank) * 2;
        const vp = [a,b,c].map(toVtrac).join('');
        const viRank = topVtrac.indexOf(vp);
        if (viRank < 5) score += (5 - viRank) * 2;
        const combPairs = [
          `${Math.min(a,b)}${Math.max(a,b)}`,
          `${Math.min(a,c)}${Math.max(a,c)}`,
          `${Math.min(b,c)}${Math.max(b,c)}`,
        ];
        for (const p of combPairs) {
          const pRank = topPairs.indexOf(p);
          if (pRank !== -1) score += Math.max(1, 4 - Math.floor(pRank / 2));
        }
        const rdIdx = rdCandidates.findIndex(([ra,rb,rc]) => ra===a && rb===b && rc===c);
        if (rdIdx !== -1) score += Math.max(1, 6 - rdIdx);
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
  const signals  = { hot3, rsRanked, topVtrac, topPairs, rdCandidates, overdue3 };
  const rand     = rng(genSeed + 1);

  const pool    = scored.slice(0, 20);
  const weights = pool.map(x => x.score);
  const total   = weights.reduce((a,b) => a+b, 0);
  let pick = rand() * total, primaryIdx = 0;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i];
    if (pick <= 0) { primaryIdx = i; break; }
  }
  const primary = pool[primaryIdx];

  const altPool    = pool.filter((_, i) => i !== primaryIdx).slice(0, 10);
  const altWeights = altPool.map(x => x.score);
  const altTotal   = altWeights.reduce((a,b) => a+b, 0);
  let altPick = rand() * altTotal, altIdx = 0;
  for (let i = 0; i < altWeights.length; i++) {
    altPick -= altWeights[i];
    if (altPick <= 0) { altIdx = i; break; }
  }
  const alt = altPool[altIdx];

  const confidence   = Math.round((primary.score / maxScore) * 100);
  const digitStats   = analyzeDigitStats(draws, primary.digits, 30);
  const altDigitStats = analyzeDigitStats(draws, alt.digits, 30);

  return {
    primary,
    alt,
    confidence,
    methods:      methodContribution(primary.digits, signals),
    digitStats,
    altDigitStats,
    overallPlay:  overallRec(digitStats),
    drawnFrom:    n,
  };
}
