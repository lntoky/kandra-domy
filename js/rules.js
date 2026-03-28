// ============================================================
// rules.js — Configurable game rules
// To modify a rule: change values in RULES below.
// ============================================================

const RULES = {
  mode60: {
    target: 60,
    minScorePerRound: 10,   // score < this → counts as 0
    winConditions: {
      reachTarget:  true,   // cumulative >= target
      double6:      true,   // player goes out with double-6
    }
  },
  mode120: {
    target: 120,
    minScorePerRound: 20,   // score < this → 0, unless exception below
    winConditions: {
      reachTarget:       true,   // cumulative >= target
      double6:           true,   // goes out with double-6 → instant win
      roundMatchesDate:  true,   // round score == today's day → instant win (overrides min)
      roundScore60:      true,   // round score (natural) >= 60 → instant win
      singlePlayerAt60:  true,   // only 1 player with cumulative >= 60 → wins
    },
    domino01Bonus: 60,           // +60 added when player goes out with 0:1
  }
};

// ── helpers ──────────────────────────────────────────────────
function getTodayDay() { return new Date().getDate(); }

/**
 * Process one player's round entry.
 *
 * @param {number} mode              - 60 or 120
 * @param {number} rawScore          - points entered this round
 * @param {string|null} action       - null | 'double6' | 'domino01'
 * @param {number} currentCumulative - player's cumulative score BEFORE this round
 * @returns {{ effectiveScore, instantWin: string|null, bonusApplied: number }}
 *
 * Minimum threshold rule:
 *   - Applies ONLY while the player's cumulative is still < minScorePerRound
 *   - Once cumulative >= minScorePerRound, every point counts (even 1)
 *
 * instantWin values: 'double6' | 'dateMatch' | 'roundScore60' | null
 */
function processRoundEntry(mode, rawScore, action, currentCumulative = 0) {
  const cfg = RULES[`mode${mode}`];
  let effectiveScore = rawScore;
  let bonusApplied   = 0;
  let instantWin     = null;

  // 1. Double-6 → instant win (no score calculation needed)
  if (action === 'double6' && cfg.winConditions.double6) {
    return { effectiveScore: rawScore, instantWin: 'double6', bonusApplied: 0 };
  }

  // 2. 0:1 bonus (mode 120 only) — add before other checks
  if (mode === 120 && action === 'domino01') {
    bonusApplied    = cfg.domino01Bonus;
    effectiveScore += bonusApplied;
  }

  // 3. Date match — overrides minimum threshold and wins (mode 120 only)
  if (mode === 120 && cfg.winConditions.roundMatchesDate && rawScore === getTodayDay()) {
    return { effectiveScore: rawScore, instantWin: 'dateMatch', bonusApplied: 0 };
  }

  // 4. Round score >= 60 naturally (not via 0:1) → instant win (mode 120 only)
  if (mode === 120 && cfg.winConditions.roundScore60 && action !== 'domino01' && effectiveScore >= 60) {
    return { effectiveScore, instantWin: 'roundScore60', bonusApplied: 0 };
  }

  // 5. Apply minimum threshold — only while player hasn't yet reached it cumulatively
  //    Once cumulative >= minScorePerRound, every point counts.
  if (action !== 'domino01' && currentCumulative < cfg.minScorePerRound) {
    if (effectiveScore < cfg.minScorePerRound) effectiveScore = 0;
  }

  return { effectiveScore, instantWin, bonusApplied };
}

/**
 * After updating cumulative scores, check post-round win conditions.
 * Returns { winnerId, reason } or null.
 */
function checkPostRoundWin(mode, cumulativeScores) {
  const cfg = RULES[`mode${mode}`];
  const entries = Object.entries(cumulativeScores);

  // singlePlayerAt60 (mode 120 only)
  if (mode === 120 && cfg.winConditions.singlePlayerAt60) {
    const at60 = entries.filter(([, s]) => s >= 60);
    if (at60.length === 1) {
      return { winnerId: at60[0][0], reason: 'singleAt60' };
    }
  }

  // reach target
  if (cfg.winConditions.reachTarget) {
    for (const [id, score] of entries) {
      if (score >= cfg.target) return { winnerId: id, reason: 'reachTarget' };
    }
  }

  return null;
}

/**
 * Human-readable win reason strings (for UI display).
 */
const WIN_REASON_LABELS = {
  double6:      '🎲 Double 6 !',
  dateMatch:    '📅 Score = date du jour !',
  roundScore60: '💥 +60 en une manche !',
  singleAt60:   '🏆 Seul à ≥ 60 pts',
  reachTarget:  '🏁 Score cible atteint',
};
