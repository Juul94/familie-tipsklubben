import { Timestamp } from 'firebase/firestore';

// ─── User ───────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt?: Timestamp;
}

// ─── Match ──────────────────────────────────────────
export interface Match {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  group?: 'championship' | 'relegation';
}

export interface MatchResult extends Match {
  result: '1' | 'x' | '2';
  homeGoals?: number;
  awayGoals?: number;
}

// ─── Round ──────────────────────────────────────────
export type RoundStatus = 'open' | 'closed' | 'finished';
export type Phase = 'regular' | 'championship' | 'relegation';

export interface Round {
  id: string;
  roundNumber: number;
  deadline: Timestamp;
  status: RoundStatus;
  phase: Phase;
  matches: Match[];
}

// ─── Prediction / Tip ───────────────────────────────
export interface Prediction {
  matchId: string;
  tip: '1' | 'x' | '2';
}

export interface Tip {
  id: string;
  roundNumber: number;
  userId: string;
  predictions: Prediction[];
  submittedAt: Timestamp;
}

// ─── Result ─────────────────────────────────────────
export interface RoundResult {
  id: string;
  roundNumber: number;
  matches: MatchResult[];
  status: 'pending' | 'partial' | 'final';
}

// ─── Standings ──────────────────────────────────────
export interface StandingEntry {
  userId: string;
  userName: string;
  totalPoints: number;
  top6Points: number;
  roundPoints: Record<number, number>;
}

// ─── Top 6 Prediction ──────────────────────────────
export interface Top6Prediction {
  id: string;
  userId: string;
  teams: string[]; // ordered 1-6
  submittedAt: Timestamp;
}

// ─── Top 6 Result ──────────────────────────────────
export interface Top6Result {
  id: string;
  teams: string[]; // ordered 1-6 (actual final standings)
}
