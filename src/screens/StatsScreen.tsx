import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/Colors';
import DrawerToggle from '../components/DrawerToggle';
import { getAllUsers, getAllResults } from '../services/firestoreService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Tip, RoundResult, User } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface UserStats {
  userId: string;
  userName: string;
  totalCorrect: number;
  totalMatches: number;
  roundsPlayed: number;
  perfectRounds: number;    // 6/6
  zeroRounds: number;       // 0/6
  avgPercent: number;
  form: number[];           // last 5 rounds points
  tipDistribution: { '1': number; x: number; '2': number };
  tipAccuracy: { '1': { correct: number; total: number }; x: { correct: number; total: number }; '2': { correct: number; total: number } };
}

function computeStats(
  users: User[],
  allTips: Tip[],
  allResults: RoundResult[],
): UserStats[] {
  const resultsMap: Record<number, Record<string, '1' | 'x' | '2'>> = {};
  const finishedRounds = allResults.filter((r) => r.status === 'final');
  finishedRounds.forEach((r) => {
    resultsMap[r.roundNumber] = {};
    r.matches.forEach((m) => {
      resultsMap[r.roundNumber][m.matchId] = m.result;
    });
  });

  const finishedRoundNumbers = new Set(finishedRounds.map((r) => r.roundNumber));

  return users.map((user) => {
    const userTips = allTips
      .filter((t) => t.userId === user.id && finishedRoundNumbers.has(t.roundNumber))
      .sort((a, b) => a.roundNumber - b.roundNumber);

    let totalCorrect = 0;
    let totalMatches = 0;
    let perfectRounds = 0;
    let zeroRounds = 0;
    const roundScores: number[] = [];
    const tipDist = { '1': 0, x: 0, '2': 0 };
    const tipAcc = {
      '1': { correct: 0, total: 0 },
      x: { correct: 0, total: 0 },
      '2': { correct: 0, total: 0 },
    };

    userTips.forEach((tip) => {
      const roundResults = resultsMap[tip.roundNumber];
      if (!roundResults) return;

      let roundCorrect = 0;
      tip.predictions.forEach((p) => {
        const actual = roundResults[p.matchId];
        if (!actual) return;

        totalMatches++;
        tipDist[p.tip]++;
        tipAcc[p.tip].total++;

        if (actual === p.tip) {
          totalCorrect++;
          roundCorrect++;
          tipAcc[p.tip].correct++;
        }
      });

      roundScores.push(roundCorrect);
      if (roundCorrect === 6) perfectRounds++;
      if (roundCorrect === 0) zeroRounds++;
    });

    const roundsPlayed = userTips.length;
    const avgPercent = totalMatches > 0 ? Math.round((totalCorrect / totalMatches) * 100) : 0;
    const form = roundScores.slice(-5);

    return {
      userId: user.id,
      userName: user.name,
      totalCorrect,
      totalMatches,
      roundsPlayed,
      perfectRounds,
      zeroRounds,
      avgPercent,
      form,
      tipDistribution: tipDist,
      tipAccuracy: tipAcc,
    };
  });
}

function FormBadges({ form }: { form: number[] }) {
  if (form.length === 0) return <Text style={styles.statMuted}>Ingen data</Text>;
  return (
    <View style={styles.formRow}>
      {form.map((score, i) => {
        const bg = score >= 4 ? Colors.success : score >= 2 ? Colors.warning : Colors.error;
        return (
          <View key={i} style={[styles.formBadge, { backgroundColor: bg }]}>
            <Text style={styles.formBadgeText}>{score}</Text>
          </View>
        );
      })}
    </View>
  );
}

function AccuracyPct(correct: number, total: number) {
  if (total === 0) return '–';
  return `${Math.round((correct / total) * 100)}%`;
}

export default function StatsScreen({ route }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [allStats, setAllStats] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(route?.params?.userId ?? null);
  const [showAll, setShowAll] = useState(false);

  const loadStats = async () => {
    try {
      const [users, results, tipsSnap] = await Promise.all([
        getAllUsers(),
        getAllResults(),
        getDocs(collection(db, 'tips')),
      ]);
      const tips = tipsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Tip));
      const stats = computeStats(users, tips, results);
      stats.sort((a, b) => a.userName.localeCompare(b.userName, 'da'));
      setAllStats(stats);
      if (!selectedUserId && user) {
        setSelectedUserId(user.id);
      }
    } catch (e) {
      console.error('Error loading stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (route?.params?.userId) {
        setSelectedUserId(route.params.userId);
        setShowAll(false);
      }
      loadStats();
    }, [user, route?.params?.userId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const currentStats = allStats.find((s) => s.userId === selectedUserId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>📊 Statistikker</Text>
          <DrawerToggle />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.content}>
          {/* User selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.userSelector}>
            <Text
              style={[
                styles.userChip,
                showAll && styles.userChipActive,
              ]}
              onPress={() => { setShowAll(true); setSelectedUserId(null); }}
            >
              Alle
            </Text>
            {allStats.map((s) => (
              <Text
                key={s.userId}
                style={[
                  styles.userChip,
                  !showAll && s.userId === selectedUserId && styles.userChipActive,
                ]}
                onPress={() => { setShowAll(false); setSelectedUserId(s.userId); }}
              >
                {s.userName}
              </Text>
            ))}
          </ScrollView>

          {showAll ? (
            <>
              {/* Alle - Overblik */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📈 Overblik</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.tableNameCell]}>Navn</Text>
                  <Text style={styles.tableHeaderCell}>Rigtige</Text>
                  <Text style={styles.tableHeaderCell}>Gns%</Text>
                  <Text style={styles.tableHeaderCell}>Runder</Text>
                </View>
                {allStats.map((s) => (
                  <View key={s.userId} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableNameCell]} numberOfLines={1}>{s.userName}</Text>
                    <Text style={styles.tableCell}>{s.totalCorrect}/{s.totalMatches}</Text>
                    <Text style={styles.tableCell}>{s.avgPercent}%</Text>
                    <Text style={styles.tableCell}>{s.roundsPlayed}</Text>
                  </View>
                ))}
              </View>

              {/* Alle - Præstationer */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🎯 Præstationer</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.tableNameCell]}>Navn</Text>
                  <Text style={styles.tableHeaderCell}>6/6 🔥</Text>
                  <Text style={styles.tableHeaderCell}>0/6 💀</Text>
                </View>
                {allStats.map((s) => (
                  <View key={s.userId} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableNameCell]} numberOfLines={1}>{s.userName}</Text>
                    <Text style={[styles.tableCell, s.perfectRounds > 0 && { color: Colors.success, fontWeight: '700' }]}>{s.perfectRounds}</Text>
                    <Text style={[styles.tableCell, s.zeroRounds > 0 && { color: Colors.error, fontWeight: '700' }]}>{s.zeroRounds}</Text>
                  </View>
                ))}
              </View>

              {/* Alle - Form */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  📉 Form (sidste {Math.min(5, Math.max(...allStats.map(s => s.form.length), 0))} {Math.min(5, Math.max(...allStats.map(s => s.form.length), 0)) === 1 ? 'runde' : 'runder'})
                </Text>
                {allStats.map((s) => (
                  <View key={s.userId} style={styles.allFormRow}>
                    <Text style={styles.allFormName} numberOfLines={1}>{s.userName}</Text>
                    <FormBadges form={s.form} />
                  </View>
                ))}
              </View>

              {/* Alle - Tipfordeling */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🔢 Tipfordeling</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.tableNameCell]}>Navn</Text>
                  <Text style={styles.tableHeaderCell}>1</Text>
                  <Text style={styles.tableHeaderCell}>X</Text>
                  <Text style={styles.tableHeaderCell}>2</Text>
                </View>
                {allStats.map((s) => {
                  const total = s.tipDistribution['1'] + s.tipDistribution.x + s.tipDistribution['2'];
                  return (
                    <View key={s.userId} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.tableNameCell]} numberOfLines={1}>{s.userName}</Text>
                      <Text style={styles.tableCell}>{s.tipDistribution['1']} ({total > 0 ? Math.round((s.tipDistribution['1'] / total) * 100) : 0}%)</Text>
                      <Text style={styles.tableCell}>{s.tipDistribution.x} ({total > 0 ? Math.round((s.tipDistribution.x / total) * 100) : 0}%)</Text>
                      <Text style={styles.tableCell}>{s.tipDistribution['2']} ({total > 0 ? Math.round((s.tipDistribution['2'] / total) * 100) : 0}%)</Text>
                    </View>
                  );
                })}
              </View>

              {/* Alle - Træfsikkerhed pr. tip */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🎯 Træfsikkerhed pr. tip</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.tableNameCell]}>Navn</Text>
                  <Text style={styles.tableHeaderCell}>1</Text>
                  <Text style={styles.tableHeaderCell}>X</Text>
                  <Text style={styles.tableHeaderCell}>2</Text>
                </View>
                {allStats.map((s) => (
                  <View key={s.userId} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableNameCell]} numberOfLines={1}>{s.userName}</Text>
                    <Text style={styles.tableCell}>{AccuracyPct(s.tipAccuracy['1'].correct, s.tipAccuracy['1'].total)}</Text>
                    <Text style={styles.tableCell}>{AccuracyPct(s.tipAccuracy.x.correct, s.tipAccuracy.x.total)}</Text>
                    <Text style={styles.tableCell}>{AccuracyPct(s.tipAccuracy['2'].correct, s.tipAccuracy['2'].total)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : currentStats ? (
            <>
              {/* Overblik */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📈 Overblik</Text>
                <View style={styles.statGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{currentStats.totalCorrect}/{currentStats.totalMatches}</Text>
                    <Text style={styles.statLabel}>Rigtige / Total</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{currentStats.avgPercent}%</Text>
                    <Text style={styles.statLabel}>Gns. træfprocent</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{currentStats.roundsPlayed}</Text>
                    <Text style={styles.statLabel}>Runder spillet</Text>
                  </View>
                </View>
              </View>

              {/* Præstationer */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🎯 Præstationer</Text>
                <View style={styles.statGrid}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: Colors.success }]}>{currentStats.perfectRounds}</Text>
                    <Text style={styles.statLabel}>6 rigtige 🔥</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: Colors.error }]}>{currentStats.zeroRounds}</Text>
                    <Text style={styles.statLabel}>0 rigtige 💀</Text>
                  </View>
                </View>
              </View>

              {/* Form */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  📉 Form (sidste {currentStats.form.length} {currentStats.form.length === 1 ? 'runde' : 'runder'})
                </Text>
                <FormBadges form={currentStats.form} />
                {currentStats.form.length > 0 && (
                  <Text style={[styles.statMuted, { marginTop: 8 }]}>
                    {currentStats.form.reduce((a, b) => a + b, 0)}/{currentStats.form.length * 6} rigtige
                  </Text>
                )}
              </View>

              {/* Tip fordeling */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🔢 Tipfordeling</Text>
                <View style={styles.distRow}>
                  {(['1', 'x', '2'] as const).map((key) => {
                    const total =
                      currentStats.tipDistribution['1'] +
                      currentStats.tipDistribution.x +
                      currentStats.tipDistribution['2'];
                    const pct = total > 0 ? Math.round((currentStats.tipDistribution[key] / total) * 100) : 0;
                    return (
                      <View key={key} style={styles.distItem}>
                        <Text style={styles.distLabel}>{key.toUpperCase()}</Text>
                        <Text style={styles.distValue}>{currentStats.tipDistribution[key]}</Text>
                        <Text style={styles.distPct}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Træfsikkerhed */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🎯 Træfsikkerhed pr. tip</Text>
                <View style={styles.distRow}>
                  {(['1', 'x', '2'] as const).map((key) => {
                    const acc = currentStats.tipAccuracy[key];
                    return (
                      <View key={key} style={styles.distItem}>
                        <Text style={styles.distLabel}>{key.toUpperCase()}</Text>
                        <Text style={styles.distValue}>{AccuracyPct(acc.correct, acc.total)}</Text>
                        <Text style={styles.distPct}>{acc.correct}/{acc.total}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.noData}>Vælg en deltager ovenfor</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 54,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  userSelector: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  userChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
    overflow: 'hidden',
  },
  userChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    color: Colors.white,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 14,
  },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statMuted: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBadgeText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  distRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  distItem: {
    alignItems: 'center',
    flex: 1,
  },
  distLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  distValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.secondary,
  },
  distPct: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  noData: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 16,
    marginTop: 40,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  tableNameCell: {
    flex: 1.5,
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '40',
    alignItems: 'center',
  },
  tableCell: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    textAlign: 'center',
  },
  allFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  allFormName: {
    width: 80,
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
});
