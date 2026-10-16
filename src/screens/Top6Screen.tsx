import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Modal, FlatList, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/Colors';
import { SUPERLIGA_TEAMS } from '../constants/Teams';
import { useAuth } from '../contexts/AuthContext';
import {
  getTop6Prediction, submitTop6Prediction,
  getAllTop6Predictions, getTop6Result, calculateTop6Points, getAllUsers,
} from '../services/firestoreService';
import { Top6Prediction, Top6Result } from '../types';
import DrawerToggle from '../components/DrawerToggle';

export default function Top6Screen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [myPrediction, setMyPrediction] = useState<string[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [allPredictions, setAllPredictions] = useState<(Top6Prediction & { userName: string })[]>([]);
  const [top6Result, setTop6Result] = useState<Top6Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<number>(0);

  const loadData = async () => {
    try {
      const [pred, allPreds, result, users] = await Promise.all([
        user ? getTop6Prediction(user.id) : null,
        getAllTop6Predictions(),
        getTop6Result(),
        getAllUsers(),
      ]);

      const usersMap: Record<string, string> = {};
      users.forEach((u) => { usersMap[u.id] = u.name; });

      if (pred) {
        setMyPrediction(pred.teams);
        setHasSubmitted(true);
      } else {
        setMyPrediction([]);
        setHasSubmitted(false);
      }

      setAllPredictions(
        allPreds.map((p) => ({ ...p, userName: usersMap[p.userId] ?? 'Ukendt' }))
      );
      setTop6Result(result);
    } catch (e) {
      console.error('Error loading top 6:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const selectedTeams = myPrediction;
  const availableTeams = SUPERLIGA_TEAMS.filter((t) => !selectedTeams.includes(t));

  const openPicker = (slot: number) => {
    setPickerSlot(slot);
    setPickerVisible(true);
  };

  const selectTeam = (team: string) => {
    const updated = [...myPrediction];
    // If slot already has a team, we're replacing
    while (updated.length <= pickerSlot) updated.push('');
    updated[pickerSlot] = team;
    setMyPrediction(updated);
    setPickerVisible(false);
  };

  const removeTeam = (slot: number) => {
    const updated = [...myPrediction];
    updated[slot] = '';
    setMyPrediction(updated);
  };

  const canSubmit = myPrediction.filter(Boolean).length === 6;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSaving(true);
    try {
      await submitTop6Prediction(user.id, myPrediction);
      setHasSubmitted(true);
      Alert.alert('Gemt!', 'Din Top 6 forudsigelse er registreret ✅');
      await loadData();
    } catch (e: any) {
      Alert.alert('Fejl', e.message ?? 'Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>⭐ Top 6</Text>
          <DrawerToggle />
        </View>
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {/* Form / My prediction */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {hasSubmitted ? '✅ Din forudsigelse' : '📝 Vælg dine Top 6'}
          </Text>
          <Text style={styles.cardSubtitle}>
            Forudsig de 6 bedste hold i Superligaen i rækkefølge
          </Text>

          {[0, 1, 2, 3, 4, 5].map((slot) => {
            const team = myPrediction[slot] || '';
            const resultTeam = top6Result?.teams[slot];
            let badge = null;
            if (top6Result && team) {
              if (team === resultTeam) {
                badge = { label: '+3', color: Colors.success };
              } else if (top6Result.teams.includes(team)) {
                badge = { label: '+1', color: Colors.warning };
              } else {
                badge = { label: '0', color: Colors.error };
              }
            }

            return (
              <TouchableOpacity
                key={slot}
                style={styles.slotRow}
                onPress={() => !hasSubmitted && openPicker(slot)}
                disabled={hasSubmitted}
              >
                <Text style={styles.slotNumber}>{slot + 1}.</Text>
                <View style={[
                  styles.slotBox,
                  team ? styles.slotFilled : styles.slotEmpty,
                  badge && badge.color === Colors.success && styles.slotCorrect,
                  badge && badge.color === Colors.warning && styles.slotWrongPosition,
                ]}>
                  <Text style={team ? styles.slotTeam : styles.slotPlaceholder}>
                    {team || 'Vælg hold...'}
                  </Text>
                </View>
                {badge && (
                  <View style={[styles.pointBadge, { backgroundColor: badge.color }]}>
                    <Text style={styles.pointBadgeText}>{badge.label}</Text>
                  </View>
                )}
                {!hasSubmitted && team ? (
                  <TouchableOpacity onPress={() => removeTeam(slot)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          })}

          {!hasSubmitted && (
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text style={styles.submitBtnText}>
                  Gem Top 6 ({myPrediction.filter(Boolean).length}/6)
                </Text>
              )}
            </TouchableOpacity>
          )}

          {top6Result && hasSubmitted && (() => {
            const pts = calculateTop6Points(myPrediction, top6Result.teams);
            return (
              <View style={styles.pointsSummary}>
                <Text style={styles.pointsTotal}>{pts.total} point</Text>
                <Text style={styles.pointsDetail}>
                  {pts.exact} korrekt placering × 3 + {pts.inTop6} i top 6 × 1
                </Text>
              </View>
            );
          })()}
        </View>

        {/* Top 6 result (if admin has entered it) */}
        {top6Result && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🏆 Endelig Top 6</Text>
            {top6Result.teams.map((team, i) => (
              <View key={i} style={styles.resultRow}>
                <Text style={styles.resultNumber}>{i + 1}.</Text>
                <Text style={styles.resultTeam}>{team}</Text>
              </View>
            ))}
          </View>
        )}

        {/* All predictions */}
        {hasSubmitted && allPredictions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>👥 Alles forudsigelser</Text>
            {allPredictions.map((pred) => {
              const pts = top6Result ? calculateTop6Points(pred.teams, top6Result.teams) : null;
              return (
                <View key={pred.userId} style={styles.predictionCard}>
                  <View style={styles.predictionHeader}>
                    <Text style={styles.predictionName}>{pred.userName}</Text>
                    {pts && <Text style={styles.predictionPoints}>{pts.total} pt</Text>}
                  </View>
                  {pred.teams.map((team, i) => {
                    let color = Colors.textSecondary;
                    if (top6Result) {
                      if (team === top6Result.teams[i]) color = Colors.success;
                      else if (top6Result.teams.includes(team)) color = Colors.warning;
                      else color = Colors.error;
                    }
                    return (
                      <Text key={i} style={[styles.predictionTeam, { color }]}>
                        {i + 1}. {team}
                      </Text>
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Team picker modal */}
      <Modal visible={pickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Vælg hold til plads {pickerSlot + 1}</Text>
            <FlatList
              data={availableTeams}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => selectTeam(item)}>
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>Alle hold er valgt</Text>
              }
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setPickerVisible(false)}>
              <Text style={styles.modalCloseText}>Annuller</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  slotNumber: {
    width: 28,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  slotBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  slotFilled: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryLight,
  },
  slotCorrect: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  slotWrongPosition: {
    backgroundColor: Colors.warning,
    borderColor: Colors.warning,
  },
  slotEmpty: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  slotTeam: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  slotPlaceholder: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  pointBadge: {
    marginLeft: 8,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pointBadgeText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  removeBtn: {
    marginLeft: 8,
    padding: 6,
  },
  removeBtnText: {
    fontSize: 16,
    color: Colors.error,
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: 12,
    backgroundColor: Colors.secondary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  pointsSummary: {
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 10,
    alignItems: 'center',
  },
  pointsTotal: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
  },
  pointsDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultNumber: {
    width: 28,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  resultTeam: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  predictionCard: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  predictionName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  predictionPoints: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  predictionTeam: {
    fontSize: 14,
    paddingVertical: 2,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalItemText: {
    fontSize: 16,
    color: Colors.text,
  },
  modalEmpty: {
    textAlign: 'center',
    color: Colors.textSecondary,
    padding: 20,
  },
  modalClose: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
  },
});
