import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, Timestamp, onSnapshot, addDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Round, Tip, Prediction, RoundResult, MatchResult, Match, User, Phase, Top6Prediction, Top6Result } from '../types';

// ═══════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════

export async function getUser(userId: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as User;
}

export async function getAllUsers(): Promise<User[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as User));
}

export async function updateUser(userId: string, data: Partial<Omit<User, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'users', userId), data);
}

// ═══════════════════════════════════════════════════════
//  PUSH TOKENS (stored on users collection)
// ═══════════════════════════════════════════════════════

export async function savePushToken(userId: string, token: string): Promise<void> {
  await setDoc(doc(db, 'users', userId), {
    pushToken: token,
    pushTokenUpdatedAt: Timestamp.now(),
  }, { merge: true });
}

export async function getAllPushTokens(): Promise<{ tokens: string[]; names: string[] }> {
  const snap = await getDocs(collection(db, 'users'));
  const results = snap.docs
    .filter((d) => Boolean(d.data().pushToken))
    .map((d) => ({ token: d.data().pushToken as string, name: (d.data().name as string) || 'Ukendt' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'da'));
  return { tokens: results.map((r) => r.token), names: results.map((r) => r.name) };
}

export async function getPushTokensExcept(excludeUserId: string): Promise<string[]> {
  const snap = await getDocs(collection(db, 'users'));
  const tokens = snap.docs
    .filter((d) => d.id !== excludeUserId)
    .map((d) => d.data().pushToken as string)
    .filter(Boolean);
  return tokens;
}

// ═══════════════════════════════════════════════════════
//  ROUNDS
// ═══════════════════════════════════════════════════════

export async function getAllRounds(): Promise<Round[]> {
  const q = query(collection(db, 'rounds'), orderBy('roundNumber', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Round));
}

export async function getRound(roundId: string): Promise<Round | null> {
  const snap = await getDoc(doc(db, 'rounds', roundId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Round;
}

export async function getOpenRound(): Promise<Round | null> {
  const q = query(
    collection(db, 'rounds'),
    where('status', '==', 'open'),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  // Sort client-side to avoid composite index requirement
  const rounds = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Round))
    .sort((a, b) => b.roundNumber - a.roundNumber);
  return rounds[0];
}

/** Admin: opret ny runde */
export async function createRound(params: {
  roundNumber: number;
  matches: Match[];
  deadline: Date;
  phase: Phase;
}): Promise<void> {
  const docId = `round_${params.roundNumber}`;
  await setDoc(doc(db, 'rounds', docId), {
    roundNumber: params.roundNumber,
    matches: params.matches,
    deadline: Timestamp.fromDate(params.deadline),
    status: 'open' as const,
    phase: params.phase,
  });
}

/** Admin: opdater runde (status, deadline, matches etc.) */
export async function updateRound(
  roundNumber: number,
  data: Partial<Omit<Round, 'id'>>,
): Promise<void> {
  const docId = `round_${roundNumber}`;
  await updateDoc(doc(db, 'rounds', docId), data);
}

/** Admin: luk runde */
export async function closeRound(roundNumber: number): Promise<void> {
  await updateRound(roundNumber, { status: 'closed' });
}

/** Admin: marker runde som afsluttet */
export async function finishRound(roundNumber: number): Promise<void> {
  await updateRound(roundNumber, { status: 'finished' });
}

/** Realtime listener på runder */
export function subscribeToRounds(callback: (rounds: Round[]) => void): Unsubscribe {
  const q = query(collection(db, 'rounds'), orderBy('roundNumber', 'desc'));
  return onSnapshot(q, (snap) => {
    const rounds = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Round));
    callback(rounds);
  });
}

// ═══════════════════════════════════════════════════════
//  TIPS
// ═══════════════════════════════════════════════════════

/** Hent alle tips for en given runde */
export async function getTipsForRound(roundNumber: number): Promise<Tip[]> {
  const q = query(collection(db, 'tips'), where('roundNumber', '==', roundNumber));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tip));
}

/** Hent en brugers tip for en runde */
export async function getUserTip(roundNumber: number, userId: string): Promise<Tip | null> {
  const docId = `${roundNumber}_${userId}`;
  const snap = await getDoc(doc(db, 'tips', docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Tip;
}

/** Bruger: indsend/opdater tip */
export async function submitTip(params: {
  roundNumber: number;
  userId: string;
  predictions: Prediction[];
}): Promise<void> {
  const docId = `${params.roundNumber}_${params.userId}`;
  await setDoc(doc(db, 'tips', docId), {
    roundNumber: params.roundNumber,
    userId: params.userId,
    predictions: params.predictions,
    submittedAt: Timestamp.now(),
  });
}

/** Realtime listener på tips for en runde */
export function subscribeToTips(
  roundNumber: number,
  callback: (tips: Tip[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'tips'), where('roundNumber', '==', roundNumber));
  return onSnapshot(q, (snap) => {
    const tips = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tip));
    callback(tips);
  });
}

// ═══════════════════════════════════════════════════════
//  RESULTS
// ═══════════════════════════════════════════════════════

/** Hent resultat for en runde */
export async function getRoundResult(roundNumber: number): Promise<RoundResult | null> {
  const snap = await getDoc(doc(db, 'results', `result_${roundNumber}`));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as RoundResult;
}

/** Hent alle resultater */
export async function getAllResults(): Promise<RoundResult[]> {
  const snap = await getDocs(collection(db, 'results'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RoundResult));
}

/** Admin: gem/opdater resultater for en runde */
export async function submitResults(params: {
  roundNumber: number;
  matches: MatchResult[];
  finishRound?: boolean;
}): Promise<void> {
  const docId = `result_${params.roundNumber}`;
  await setDoc(doc(db, 'results', docId), {
    roundNumber: params.roundNumber,
    matches: params.matches,
    status: params.finishRound ? 'final' : 'partial',
  });
  if (params.finishRound) {
    await finishRound(params.roundNumber);
  }
}

/**
 * Check alle åbne runder hvor deadline er overskredet.
 * For brugere der ikke har tippet, indsættes uafgjort (x) på alle kampe.
 */
export async function autoFillMissedTips(): Promise<void> {
  const rounds = await getAllRounds();
  const now = new Date();

  const expiredOpenRounds = rounds.filter((r) => {
    if (r.status !== 'open') return false;
    const dl = r.deadline instanceof Date
      ? r.deadline
      : (r.deadline as any)?.toDate
        ? (r.deadline as any).toDate()
        : new Date(r.deadline as any);
    return dl < now;
  });

  if (expiredOpenRounds.length === 0) return;

  const allUsers = await getAllUsers();

  for (const round of expiredOpenRounds) {
    const tips = await getTipsForRound(round.roundNumber);
    const tippedUserIds = new Set(tips.map((t) => t.userId));

    const defaultPredictions: Prediction[] = round.matches.map((m, i) => ({
      matchId: m.matchId ?? `match_${i}`,
      tip: 'x' as const,
    }));

    for (const user of allUsers) {
      if (!tippedUserIds.has(user.id)) {
        await submitTip({
          roundNumber: round.roundNumber,
          userId: user.id,
          predictions: defaultPredictions,
        });
      }
    }
  }
}

// ═══════════════════════════════════════════════════════
//  STANDINGS (beregning)
// ═══════════════════════════════════════════════════════

export async function calculateStandings() {
  const [users, allTips, allResults, top6Preds, top6Result] = await Promise.all([
    getAllUsers(),
    getDocs(collection(db, 'tips')).then((s) =>
      s.docs.map((d) => ({ id: d.id, ...d.data() } as Tip)),
    ),
    getAllResults(),
    getAllTop6Predictions(),
    getTop6Result(),
  ]);

  // Byg resultat-map: roundNumber -> matchId -> result
  const resultsMap: Record<number, Record<string, '1' | 'x' | '2'>> = {};
  allResults
    .filter((r) => r.status === 'final')
    .forEach((r) => {
      resultsMap[r.roundNumber] = {};
      r.matches.forEach((m) => {
        resultsMap[r.roundNumber][m.matchId] = m.result;
      });
    });

  // Top 6 point pr. bruger
  const top6PointsMap: Record<string, number> = {};
  if (top6Result) {
    top6Preds.forEach((pred) => {
      const pts = calculateTop6Points(pred.teams, top6Result.teams);
      top6PointsMap[pred.userId] = pts.total;
    });
  }

  // Beregn point pr. bruger
  const pointsMap: Record<string, { total: number; rounds: Record<number, number> }> = {};
  users.forEach((u) => {
    pointsMap[u.id] = { total: top6PointsMap[u.id] ?? 0, rounds: {} };
  });

  allTips.forEach((tip) => {
    const roundResults = resultsMap[tip.roundNumber];
    if (!roundResults) return;

    let roundPoints = 0;
    tip.predictions.forEach((p) => {
      if (roundResults[p.matchId] === p.tip) {
        roundPoints += 1;
      }
    });

    if (!pointsMap[tip.userId]) {
      pointsMap[tip.userId] = { total: 0, rounds: {} };
    }
    pointsMap[tip.userId].total += roundPoints;
    pointsMap[tip.userId].rounds[tip.roundNumber] = roundPoints;
  });

  const usersMap: Record<string, string> = {};
  users.forEach((u) => { usersMap[u.id] = u.name; });

  return Object.entries(pointsMap)
    .map(([userId, data]) => ({
      userId,
      userName: usersMap[userId] ?? 'Ukendt',
      totalPoints: data.total,
      top6Points: top6PointsMap[userId] ?? 0,
      roundPoints: data.rounds,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

// ═══════════════════════════════════════════════════════
//  TOP 6
// ═══════════════════════════════════════════════════════

/** Hent alle Top 6 forudsigelser */
export async function getAllTop6Predictions(): Promise<Top6Prediction[]> {
  const snap = await getDocs(collection(db, 'top6_predictions'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Top6Prediction));
}

/** Hent en brugers Top 6 forudsigelse */
export async function getTop6Prediction(userId: string): Promise<Top6Prediction | null> {
  const snap = await getDoc(doc(db, 'top6_predictions', userId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Top6Prediction;
}

/** Gem/opdater Top 6 forudsigelse */
export async function submitTop6Prediction(userId: string, teams: string[]): Promise<void> {
  await setDoc(doc(db, 'top6_predictions', userId), {
    userId,
    teams,
    submittedAt: Timestamp.now(),
  });
}

/** Hent Top 6 resultat */
export async function getTop6Result(): Promise<Top6Result | null> {
  const snap = await getDoc(doc(db, 'top6_results', 'final'));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Top6Result;
}

/** Admin: gem Top 6 resultat */
export async function submitTop6Result(teams: string[]): Promise<void> {
  await setDoc(doc(db, 'top6_results', 'final'), { teams });
}

/** Beregn Top 6 point for en bruger */
export function calculateTop6Points(prediction: string[], result: string[]): { total: number; exact: number; inTop6: number } {
  let exact = 0;
  let inTop6 = 0;
  prediction.forEach((team, i) => {
    if (team === result[i]) {
      exact++;
    } else if (result.includes(team)) {
      inTop6++;
    }
  });
  return { total: exact * 3 + inTop6, exact, inTop6 };
}

// ═══════════════════════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════════════════════

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Timestamp;
}

export function subscribeToChatMessages(callback: (messages: ChatMessage[]) => void): Unsubscribe {
  const q = query(collection(db, 'chat_messages'), orderBy('timestamp', 'desc'), limit(200));
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage));
    callback(messages);
  });
}

export async function sendChatMessage(userId: string, userName: string, message: string): Promise<void> {
  await addDoc(collection(db, 'chat_messages'), {
    userId,
    userName,
    message: message.trim(),
    timestamp: Timestamp.now(),
  });
}

// ═══════════════════════════════════════════════════════
//  APP CONFIG
// ═══════════════════════════════════════════════════════

export async function getMinRequiredVersion(): Promise<string | null> {
  const snap = await getDoc(doc(db, 'config', 'app'));
  if (!snap.exists()) return null;
  return snap.data()?.minVersion ?? null;
}
