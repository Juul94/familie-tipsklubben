import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getAllRounds, getAllResults, getUserTip } from '../services/firestoreService';
import { Round } from '../types';
import { Colors } from '../constants/Colors';
import DrawerToggle from '../components/DrawerToggle';
import Confetti from '../components/Confetti';

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [activeRound, setActiveRound] = useState<Round | null>(null); // Igangværende
  const [nextRound, setNextRound] = useState<Round | null>(null);     // Åben
  const [hasTippedNext, setHasTippedNext] = useState(false);
  const [seasonFinished, setSeasonFinished] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isPastDeadline = (round: Round) => {
    const d = (round.deadline as any)?.toDate
      ? (round.deadline as any).toDate()
      : new Date(round.deadline as any);
    return new Date() > d;
  };

  const fetchCurrentRound = async () => {
    try {
      const [rounds, results] = await Promise.all([getAllRounds(), getAllResults()]);

      const resultCounts: Record<number, number> = {};
      results.forEach((r) => {
        resultCounts[r.roundNumber] = r.matches.filter((m) => m.result).length;
      });

      // Igangværende: deadline passeret, men ikke alle resultater er indtastet
      const inProgress = rounds
        .filter((r) => isPastDeadline(r) && (resultCounts[r.roundNumber] ?? 0) < r.matches.length)
        .sort((a, b) => b.roundNumber - a.roundNumber);
      const active = inProgress[0] ?? null;

      // Åben: deadline ikke passeret – næste runde er den med lavest nummer
      const openRounds = rounds
        .filter((r) => !isPastDeadline(r))
        .sort((a, b) => a.roundNumber - b.roundNumber);
      const next = openRounds[0] ?? null;

      setActiveRound(active);
      setNextRound(next);

      // Sæsonen er slut når alle runder er "Afsluttet" (ingen åbne og ingen igangværende)
      setSeasonFinished(rounds.length > 0 && !active && !next);

      if (next && user) {
        const myTip = await getUserTip(next.roundNumber, user.id);
        setHasTippedNext(!!myTip);
      } else {
        setHasTippedNext(false);
      }
    } catch (error) {
      console.error('Error fetching current round:', error);
    }
  };

  useEffect(() => {
    fetchCurrentRound();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchCurrentRound();
    }, [user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchCurrentRound();
    } finally {
      setRefreshing(false);
    }
  };

  const formatDeadline = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    const formatted = date.toLocaleDateString('da-DK', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    if (diffMs <= 0) return `${formatted} (udløbet)`;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;
    if (diffDays > 0) {
      return `${formatted} (${diffDays} ${diffDays === 1 ? 'dag' : 'dage'} tilbage)`;
    }
    return `${formatted} (${remainingHours} ${remainingHours === 1 ? 'time' : 'timer'} tilbage)`;
  };

  const isBeforeDeadline = (timestamp: any) => {
    if (!timestamp?.toDate) return true;
    return new Date() < timestamp.toDate();
  };

  const phaseLabel = (round: Round) =>
    round.phase === 'regular' ? 'Grundspil' :
    round.phase === 'championship' ? 'Mesterskabsspil' : 'Nedrykningsspil';

  const showSeasonEnd = seasonFinished;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.greeting}>Hej, {user?.name ?? 'bruger'}! 👋</Text>
              <DrawerToggle />
            </View>
          <Text style={styles.headerSubtitle}>Familietipsklubben</Text>
        </View>

        {showSeasonEnd ? (
          /* Sæson-afslutning – fejring med konfetti */
          <View style={styles.celebrationCard}>
            <Text style={styles.celebrationEmoji}>🏆</Text>
            <Text style={styles.celebrationTitle}>Sæsonen er slut!</Text>
            <Text style={styles.celebrationSubtitle}>
              Tak for en fantastisk sæson 🎉{'\n'}Se hvem der løb med sejren!
            </Text>
            <Text style={styles.celebrationInfo}>
              Weekenden efter superligaen er afsluttet holder vi afslutningsfest om lørdagen – enten i Helsinge eller Hundested. Mere info følger!
            </Text>
            <TouchableOpacity
              style={styles.celebrationButtonPrimary}
              onPress={() => navigation.navigate('Stilling')}
            >
              <Text style={styles.celebrationButtonPrimaryText}>🥇 Se afgørelsen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.celebrationButtonSecondary}
              onPress={() => navigation.navigate('Top 6')}
            >
              <Text style={styles.celebrationButtonSecondaryText}>⭐ Se top 6</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Aktiv runde – vises kun når en runde er igangværende */}
            {activeRound && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🏟️ Aktiv runde</Text>
                <Text style={styles.roundNumber}>Runde {activeRound.roundNumber}</Text>
                <Text style={styles.phase}>{phaseLabel(activeRound)}</Text>
                <Text style={styles.deadline}>
                  Deadline: {formatDeadline(activeRound.deadline)}
                </Text>
                <TouchableOpacity
                  style={styles.tipButton}
                  onPress={() => {
                    navigation.navigate('Runder', {
                      screen: 'Tips',
                      params: { round: activeRound },
                    });
                  }}
                >
                  <Text style={styles.tipButtonText}>👀 Se runde →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Næste runde – vises kun når en runde er åben (deadline ikke passeret) */}
            {nextRound && (
              <View style={[styles.card, hasTippedNext && styles.cardTipped]}>
                <Text style={styles.cardTitle}>🔜 Næste runde</Text>
                <Text style={styles.roundNumber}>Runde {nextRound.roundNumber}</Text>
                <Text style={styles.phase}>{phaseLabel(nextRound)}</Text>
                <Text style={styles.deadline}>
                  Deadline: {formatDeadline(nextRound.deadline)}
                </Text>
                {hasTippedNext && (
                  <Text style={[styles.tipStatus, styles.tipped]}>✅ Du har tippet</Text>
                )}
                <TouchableOpacity
                  style={styles.tipButton}
                  onPress={() => {
                    navigation.navigate('Runder', {
                      screen: 'Tips',
                      params: { round: nextRound },
                    });
                  }}
                >
                  <Text style={styles.tipButtonText}>
                    {hasTippedNext ? '✏️ Ændre tips →' : '⏳ Tip nu →'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Afslutning info – vises som separat kort under sæsonen, men flyttes ind i fejringskortet når sæsonen er slut */}
        {!showSeasonEnd && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎉 Afslutning</Text>
            <Text style={styles.infoText}>
              Weekenden efter superligaen er afsluttet holder vi afslutningsfest om lørdagen – enten i Helsinge eller Hundested. Mere info følger!
            </Text>
          </View>
        )}
      </ScrollView>

      {showSeasonEnd && <Confetti />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.secondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTipped: {
    borderWidth: 2,
    borderColor: Colors.success,
  },
  celebrationCard: {
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  celebrationEmoji: {
    fontSize: 60,
    marginBottom: 8,
  },
  celebrationTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
  },
  celebrationSubtitle: {
    fontSize: 15,
    color: Colors.secondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 14,
    lineHeight: 22,
  },
  celebrationInfo: {
    fontSize: 14,
    color: Colors.secondary,
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 20,
  },
  celebrationButtonPrimary: {
    backgroundColor: Colors.secondary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  celebrationButtonPrimaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.primary,
  },
  celebrationButtonSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  celebrationButtonSecondaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.secondary,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  roundNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  phase: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  deadline: {
    fontSize: 14,
    color: Colors.warning,
    marginTop: 8,
    fontWeight: '500',
  },
  matchCount: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  noRound: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  adminBadge: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  tipStatus: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  tipped: {
    color: Colors.success,
  },
  tipButton: {
    marginTop: 12,
    backgroundColor: Colors.secondary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tipButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  notTipped: {
    color: Colors.error,
  },
});
