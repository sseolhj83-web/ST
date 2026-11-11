/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Match stats, kept entirely on-device (no account system — see [[project]] removal of
// login/signup in favor of room codes). Keyed by the player's persistent local guest id.

export interface UserStats {
  highest_score: number;
  total_frags: number;
  total_deaths: number;
  matches_played: number;
}

const STORAGE_PREFIX = 'xonotic_stats_';

const EMPTY_STATS: UserStats = {
  highest_score: 0,
  total_frags: 0,
  total_deaths: 0,
  matches_played: 0,
};

export function loadLocalStats(userId: string): UserStats {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (raw) return { ...EMPTY_STATS, ...JSON.parse(raw) };
  } catch {}
  return { ...EMPTY_STATS };
}

export function saveLocalMatchResult(userId: string, score: number, deaths: number): UserStats {
  const current = loadLocalStats(userId);
  const updated: UserStats = {
    highest_score: Math.max(current.highest_score, score),
    total_frags: current.total_frags + score,
    total_deaths: current.total_deaths + deaths,
    matches_played: current.matches_played + 1,
  };
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(updated));
  } catch {}
  return updated;
}
