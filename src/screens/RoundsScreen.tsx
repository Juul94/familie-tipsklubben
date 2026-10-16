import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllRounds, subscribeToRounds, getUserTip, getRoundResult } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { Round } from '../types';
import { Colors } from '../constants/Colors';
import DrawerToggle from '../components/DrawerToggle';

export default function RoundsScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundScores, setRoundScores] = useState<Record<number, { correct: number; total: number; points: number } | null>>({});
  const [resultCounts, setResultCounts] = useState<Record<number, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadScores = async (roundsList: Round[]) => {
    if (!user) return;
    const scores: Record<number, { correct: number; total: number; points: number } | null> = {};
    const counts: Record<number, number> = {};
    await Promise.all(
      roundsList
        .filter((r) => isPastDeadline(r))
        .map(async (round) => {
          try {
            const result = await getRoundResult(round.roundNumber);
            counts[round.roundNumber] = result
              ? result.matches.filter((m) => m.result).length
              : 0;
            if (result && result.status === 'final') {
              const tip = await getUserTip(round.roundNumber, user.id);
              if (tip) {
                const resultMap: Record<string, string> = {};
                result.matches.forEach((m) => { resultMap[m.matchId] = m.result; });
                let correct = 0;
                tip.predictions.forEach((p) => {
                  if (resultMap[p.matchId] === p.tip) correct++;
                });
                scores[round.roundNumber] = { correct, total: tip.predictions.length, points: correct };
              } else {
                scores[round.roundNumber] = null;
              }
            }
          } catch {
            counts[round.roundNumber] = 0;
          }
        }),
    );
    setRoundScores(scores);
    setResultCounts(counts);
  };

  useEffect(() => {
    const unsubscribe = subscribeToRounds((data) => {
      setRounds(data);
      loadScores(data).finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await getAllRounds();
      setRounds(data);
      await loadScores(data);
    } catch (e) {
      console.error('Error refreshing rounds:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const toDate = (deadline: any): Date =>
    deadline instanceof Date
      ? deadline
      : deadline?.toDate
        ? deadline.toDate()
        : new Date(deadline);

  const isPastDeadline = (round: Round) => new Date() > toDate(round.deadline);

  const getDisplayStatus = (round: Round) => {
    if (!isPastDeadline(round)) return { text: 'Åben', color: Colors.success };
    const count = resultCounts[round.roundNumber] ?? 0;
    if (count >= round.matches.length) return { text: 'Afsluttet', color: Colors.textSecondary };
    return { text: 'Igangværende', color: Colors.warning };
  };

  const formatDeadline = (round: Round) =>
    toDate(round.deadline).toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const renderRound = ({ item }: { item: Round }) => {
    const status = getDisplayStatus(item);
    const score = roundScores[item.roundNumber];
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Tips', { round: item })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.roundNumber}>Runde {item.roundNumber}</Text>
          <View style={[styles.badge, { backgroundColor: status.color }]}>
            <Text style={styles.badgeText}>{status.text}</Text>
          </View>
        </View>
        {score && (
          <Text style={styles.scoreText}>
            ✅ {score.correct}/{score.total} ({score.points} {score.points === 1 ? 'point' : 'point'})
          </Text>
        )}
        <Text style={styles.matchCount}>Deadline: {formatDeadline(item)}</Text>
        <Text style={styles.phase}>
          {item.phase === 'regular' ? 'Grundspil' :
           item.phase === 'championship' ? 'Mesterskabsspil' : 'Nedrykningsspil'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>⚽ Runder</Text>
          <DrawerToggle />
        </View>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rounds}
          keyExtractor={(item) => item.id}
          renderItem={renderRound}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.empty}>Ingen runder endnu</Text>
          }
        />
      )}
    </View>
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    marginTop: 8,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roundNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  matchCount: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  deadlineWarning: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.error,
    marginTop: 6,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 6,
  },
  phase: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: 40,
    fontSize: 16,
  },
});
