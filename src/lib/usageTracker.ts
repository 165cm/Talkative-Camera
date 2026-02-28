/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const USAGE_STORAGE_KEY = 'talkativeCamera_usage';
export const MAX_SESSIONS_PER_DAY = 20;  // ~100¥/day at 5¥/session
export const COST_PER_SESSION_YEN = 5;    // ≈ $0.03-0.04 per session at 150¥/$

interface UsageData {
  date: string;              // 'YYYY-MM-DD'
  sessions: number;
  estimatedCostYen: number;
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getUsageData(): UsageData {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY);
    if (raw) {
      const data: UsageData = JSON.parse(raw);
      if (data.date === getTodayString()) {
        return data;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return { date: getTodayString(), sessions: 0, estimatedCostYen: 0 };
}

export function recordSession(): UsageData {
  const current = getUsageData();
  const updated: UsageData = {
    date: current.date,
    sessions: current.sessions + 1,
    estimatedCostYen: (current.sessions + 1) * COST_PER_SESSION_YEN,
  };
  try {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
  return updated;
}

export function isLimitReached(): boolean {
  return getUsageData().sessions >= MAX_SESSIONS_PER_DAY;
}
