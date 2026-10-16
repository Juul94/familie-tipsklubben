import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { getTipsForRound, getAllUsers, submitTip as submitTipService, getRoundResult, getRound } from '../services/firestoreService';
import { cancelRoundReminder } from '../services/notificationService';
import { Round, Tip, Prediction, RoundResult } from '../types';
import { Colors } from '../constants/Colors';

export default function TipsScreen({ route }: any) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const round: Round | undefined = route?.params?.round;
  const [predictions, setPredictions] = useState<Record<string, '1' | 'x' | '2'>>({});
  const [allTips, setAllTips] = useState<(Tip & { userName?: string })[]>([]);
  const [saving, setSaving] = useState(false);
  const [myTipSaved, setMyTipSaved] = useState(false);
  const [resultsMap, setResultsMap] = useState<Record<string, '1' | 'x' | '2'>>({});

  useEffect(() => {
    if (round) {
      fetchTips();
    }
  }, [round]);

  const fetchTips = async () => {
    if (!round) return;
    try {
      const tips = await getTipsForRound(round.roundNumber);
      const users = await getAllUsers();

      const usersMap: Record<string, string> = {};
      users.forEach((u) => { usersMap[u.id] = u.name; });

      const tipsWithNames = tips.map((t) => ({ ...t, userName: usersMap[t.userId] ?? 'Ukendt' }));
      setAllTips(tipsWithNames);

      // Fetch results (also partial) so played matches show correct/wrong
      const result = await getRoundResult(round.roundNumber);
      if (result) {
        const rMap: Record<string, '1' | 'x' | '2'> = {};
        result.matches.forEach((m) => {
          if (m.result) rMap[m.matchId] = m.result;
        });
        setResultsMap(rMap);
      }

      // Load my existing tip
      const myTip = tips.find((t) => t.userId === user?.id);
      if (myTip) {
        const map: Record<string, '1' | 'x' | '2'> = {};
        myTip.predictions.forEach((p, i) => {
          const id = p.matchId ?? `match_${i}`;
          map[id] = p.tip;
        });
        setPredictions(map);
        setMyTipSaved(true);
      }
    } catch (error) {
      console.error('Error fetching tips:', error);
    }
  };

  const getMatchId = (match: any, index: number): string => {
    return match.matchId ?? `match_${index}`;
  };

  const isBeforeDeadline = () => {
    if (!round?.deadline) return true;
    const dl = round.deadline instanceof Date ? round.deadline
      : (round.deadline as any)?.toDate ? (round.deadline as any).toDate()
      : new Date(round.deadline as any);
    return new Date() < dl;
  };

  const canTip = round?.status === 'open' && isBeforeDeadline();

  const selectTip = (matchId: string, tip: '1' | 'x' | '2') => {
    if (!canTip) return;
    setPredictions((prev) => ({ ...prev, [matchId]: tip }));
  };

  const submitTip = async () => {
    if (!round || !user) return;
    if (!canTip) {
      Alert.alert('For sent', 'Deadline er overskredet — du kan ikke længere tippe denne runde.');
      return;
    }

    // Tjek live status inden vi gemmer
    const freshRound = await getRound(round.id);
    if (freshRound && freshRound.status !== 'open') {
      Alert.alert('Runden er lukket', 'Admin har lukket denne runde. Du kan ikke længere tippe.');
      return;
    }
    const missing = round.matches.filter((m, i) => !predictions[getMatchId(m, i)]);
    if (missing.length > 0) {
      Alert.alert('Mangler tips', `Du mangler at tippe ${missing.length} kamp(e)`);
      return;
    }

    setSaving(true);
    try {
      const tipPredictions: Prediction[] = round.matches.map((m, i) => {
        const id = getMatchId(m, i);
        return {
          matchId: id,
          tip: predictions[id],
        };
      });

      await submitTipService({
        roundNumber: round.roundNumber,
        userId: user.id,
        predictions: tipPredictions,
      });

      setMyTipSaved(true);
      Alert.alert('Gemt!', 'Dit tip er registreret ✅');
      cancelRoundReminder(round.roundNumber).catch(console.error);
      await fetchTips();
    } catch (error: any) {
      Alert.alert('Fejl', error.message ?? 'Kunne ikke gemme tip');
    } finally {
      setSaving(false);
    }
  };

  if (!round) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Vælg en runde fra Runder-fanen</Text>
      </View>
    );
  }

  const tipOptions: ('1' | 'x' | '2')[] = ['1', 'x', '2'];

  const getTipButtonStyle = (matchId: string, opt: '1' | 'x' | '2') => {
    const correctResult = resultsMap[matchId];
    if (!correctResult) return null;
    if (opt === correctResult) return styles.tipButtonCorrect;
    return null;
  };

  const getTipTextStyle = (_matchId: string, _opt: '1' | 'x' | '2') => {
    return null;
  };

  const tipLabel = (opt: '1' | 'x' | '2', match: { homeTeam: string; awayTeam: string }) => {
    if (opt === '1') return match.homeTeam;
    if (opt === '2') return match.awayTeam;
    return 'Uafgjort';
  };

  const tipLabelShort = (tip: string, match: { homeTeam: string; awayTeam: string }) => {
    if (tip === '1') return match.homeTeam;
    if (tip === '2') return match.awayTeam;
    return 'Uafgjort';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Tilbage</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Runde {round.roundNumber}</Text>
        <Text style={styles.status}>
          {!isBeforeDeadline() ? '🔴 Deadline overskredet' :
           round.status === 'open' ? '🟢 Åben for tips' :
           round.status === 'closed' ? '🟡 Lukket' : '⚪ Afsluttet'}
        </Text>
      </View>

      <View>
        {/* All tips overview (visible when deadline has passed or round is finished) */}
        {(!isBeforeDeadline() || round.status === 'closed' || round.status === 'finished') && allTips.length > 0 && (() => {
          const sortedTips = [...allTips]
            .map((tip) => {
              let score = 0;
              const predMap: Record<string, string> = {};
              tip.predictions.forEach((p) => { predMap[p.matchId] = p.tip; });
              round.matches.forEach((match, matchIdx) => {
                const matchId = match.matchId ?? `match_${matchIdx}`;
                if (predMap[matchId] && resultsMap[matchId] && predMap[matchId] === resultsMap[matchId]) {
                  score++;
                }
              });
              return { ...tip, score };
            })
            .sort((a, b) => {
              if (a.userId === user?.id) return -1;
              if (b.userId === user?.id) return 1;
              return (a.userName ?? '').localeCompare(b.userName ?? '');
            });

          return (
            <View>
              <Text style={styles.sectionTitle}>Alle tips</Text>
              <View style={styles.allTipsContainer}>
                {/* Fixed name column */}
                <View style={styles.allTipsFixedCol}>
                  <View style={styles.allTipsNameHeader}>
                    <Text style={styles.allTipsHeaderText}>Navn</Text>
                  </View>
                  {sortedTips.map((tip, tipIndex) => (
                    <View key={`name-${tipIndex}`} style={[styles.allTipsNameRow, tipIndex % 2 === 0 && styles.allTipsRowAlt]}>
                      <Text style={styles.allTipsName} numberOfLines={1}>{tip.userName}</Text>
                    </View>
                  ))}
                </View>
                {/* Scrollable match columns */}
                <ScrollView horizontal showsHorizontalScrollIndicator style={styles.allTipsScrollArea}>
                  <View>
                    <View style={styles.allTipsHeaderRow}>
                      {round.matches.map((m, i) => (
                        <View key={`hdr-${i}`} style={styles.allTipsMatchCell}>
                          <Text style={styles.allTipsMatchText} numberOfLines={1}>{m.homeTeam}</Text>
                          <Text style={styles.allTipsVsText}>vs</Text>
                          <Text style={styles.allTipsMatchText} numberOfLines={1}>{m.awayTeam}</Text>
                        </View>
                      ))}
                      {Object.keys(resultsMap).length > 0 && (
                        <View style={styles.allTipsScoreCell}>
                          <Text style={styles.allTipsHeaderText}>Point</Text>
                        </View>
                      )}
                    </View>
                    {sortedTips.map((tip, tipIndex) => (
                      <View key={`tiprow-${tipIndex}`} style={[styles.allTipsRow, tipIndex % 2 === 0 && styles.allTipsRowAlt]}>
                        {(() => {
                          const predMap: Record<string, string> = {};
                          tip.predictions.forEach((p) => { predMap[p.matchId] = p.tip; });
                          return round.matches.map((match, matchIdx) => {
                            const matchId = match.matchId ?? `match_${matchIdx}`;
                            const pred = predMap[matchId];
                            const isCorrect = pred && resultsMap[matchId] && pred === resultsMap[matchId];
                            const isWrong = pred && resultsMap[matchId] && pred !== resultsMap[matchId];
                            return (
                              <View key={`tip-${tipIndex}-${matchIdx}`} style={[
                                styles.allTipsMatchCell,
                                isCorrect && styles.allTipCorrect,
                                isWrong && styles.allTipWrong,
                              ]}>
                                <Text style={[styles.allTipValue, isCorrect && styles.allTipValueCorrect]}>
                                  {pred ? tipLabelShort(pred, match) : '-'}
                                </Text>
                              </View>
                            );
                          });
                        })()}
                        {Object.keys(resultsMap).length > 0 && (
                          <View style={styles.allTipsScoreCell}>
                            <Text style={styles.allTipScore}>{tip.score}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          );
        })()}

        {/* My tips */}
        <Text style={styles.sectionTitle}>Dine tips</Text>
        {(() => {
          const hasGroups = round.matches.some((m) => m.group);
          if (hasGroups) {
            const champMatches = round.matches
              .map((m, i) => ({ match: m, index: i }))
              .filter(({ match }) => match.group === 'championship');
            const relegMatches = round.matches
              .map((m, i) => ({ match: m, index: i }))
              .filter(({ match }) => match.group === 'relegation');
            return (
              <>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupHeaderText}>🏆 Mesterskabsspil</Text>
                </View>
                {champMatches.map(({ match, index: matchIndex }) => {
                  const matchId = getMatchId(match, matchIndex);
                  return (
                    <View key={`match-${matchIndex}`} style={[styles.matchCard, styles.matchCardChampionship]}>
                      <Text style={styles.matchText}>
                        {match.homeTeam} - {match.awayTeam}
                      </Text>
                      <View style={styles.tipRow}>
                        {tipOptions.map((opt) => (
                          <TouchableOpacity
                            key={`${matchIndex}-${opt}`}
                            style={[styles.tipButton, predictions[matchId] === opt && styles.tipButtonSelected, getTipButtonStyle(matchId, opt)]}
                            onPress={() => selectTip(matchId, opt)}
                            disabled={!canTip}
                          >
                            <Text style={[styles.tipButtonText, predictions[matchId] === opt && styles.tipButtonTextSelected, getTipTextStyle(matchId, opt)]}>
                              {tipLabel(opt, match)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })}
                <View style={[styles.groupHeader, { marginTop: 16 }]}>
                  <Text style={styles.groupHeaderText}>⬇️ Nedrykningsspil</Text>
                </View>
                {relegMatches.map(({ match, index: matchIndex }) => {
                  const matchId = getMatchId(match, matchIndex);
                  return (
                    <View key={`match-${matchIndex}`} style={[styles.matchCard, styles.matchCardRelegation]}>
                      <Text style={styles.matchText}>
                        {match.homeTeam} - {match.awayTeam}
                      </Text>
                      <View style={styles.tipRow}>
                        {tipOptions.map((opt) => (
                          <TouchableOpacity
                            key={`${matchIndex}-${opt}`}
                            style={[styles.tipButton, predictions[matchId] === opt && styles.tipButtonSelected, getTipButtonStyle(matchId, opt)]}
                            onPress={() => selectTip(matchId, opt)}
                            disabled={!canTip}
                          >
                            <Text style={[styles.tipButtonText, predictions[matchId] === opt && styles.tipButtonTextSelected, getTipTextStyle(matchId, opt)]}>
                              {tipLabel(opt, match)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </>
            );
          }
          return round.matches.map((match, matchIndex) => {
            const matchId = getMatchId(match, matchIndex);
            return (
              <View key={`match-${matchIndex}`} style={styles.matchCard}>
                <Text style={styles.matchText}>
                  {match.homeTeam} - {match.awayTeam}
                </Text>
                <View style={styles.tipRow}>
                  {tipOptions.map((opt) => (
                    <TouchableOpacity
                      key={`${matchIndex}-${opt}`}
                      style={[styles.tipButton, predictions[matchId] === opt && styles.tipButtonSelected, getTipButtonStyle(matchId, opt)]}
                      onPress={() => selectTip(matchId, opt)}
                      disabled={!canTip}
                    >
                      <Text style={[styles.tipButtonText, predictions[matchId] === opt && styles.tipButtonTextSelected, getTipTextStyle(matchId, opt)]}>
                        {tipLabel(opt, match)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          });
        })()}

        {canTip && (
          <TouchableOpacity
            style={[styles.submitButton, saving && styles.buttonDisabled]}
            onPress={submitTip}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>
                {myTipSaved ? 'Opdater tip' : 'Gem tip'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={{ height: insets.bottom + 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  header: {
    paddingTop: 54,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
  backButton: {
    fontSize: 16,
    color: Colors.secondary,
    marginBottom: 8,
  },
  status: {
    fontSize: 14,
    color: Colors.secondary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  groupHeader: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  groupHeaderText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  matchCard: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 14,
  },
  matchCardChampionship: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  matchCardRelegation: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  matchText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 10,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tipButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tipButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tipButtonCorrect: {
    borderColor: '#27ae60',
    borderWidth: 3,
  },
  tipButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  tipButtonTextSelected: {
    color: Colors.white,
  },
  submitButton: {
    backgroundColor: Colors.secondary,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  otherTipCard: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  otherTipName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
  },
  otherTipPredictions: {
    flexDirection: 'row',
    gap: 8,
  },
  otherTipValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    width: 24,
    textAlign: 'center',
  },
  // All tips table
  allTipsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  allTipsFixedCol: {
    zIndex: 1,
    backgroundColor: Colors.card,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  allTipsNameHeader: {
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    width: 110,
    justifyContent: 'center',
    height: 58,
  },
  allTipsNameRow: {
    width: 110,
    paddingHorizontal: 10,
    justifyContent: 'center',
    height: 44,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  allTipsScrollArea: {
    flex: 1,
  },
  allTipsHeaderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderTopRightRadius: 10,
    paddingVertical: 10,
    height: 58,
  },
  allTipsHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  allTipsMatchCell: {
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  allTipsMatchText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
  },
  allTipsVsText: {
    fontSize: 10,
    color: Colors.secondary,
  },
  allTipsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  allTipsRowAlt: {
    backgroundColor: '#f4f5f7',
  },
  allTipsName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  allTipValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
  },
  allTipCorrect: {
    backgroundColor: 'rgba(39, 174, 96, 0.15)',
  },
  allTipWrong: {
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
  },
  allTipValueCorrect: {
    color: '#27ae60',
  },
  allTipsScoreCell: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allTipScore: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
});
