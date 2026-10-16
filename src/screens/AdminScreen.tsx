import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Platform,
  TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList, BackHandler, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import {
  createRound as createRoundService,
  closeRound as closeRoundService,
  updateRound,
  submitResults as submitResultsService,
  getAllRounds,
  getAllResults,
  getRoundResult,
  getTop6Result,
  submitTop6Result,
} from '../services/firestoreService';
import { sendPushNotificationToAll } from '../services/notificationService';
import { openSuperligaKampprogram } from '../services/superligaService';
import { Round, MatchResult, Match } from '../types';
import { Colors } from '../constants/Colors';
import { SUPERLIGA_TEAMS } from '../constants/Teams';

import DrawerToggle from '../components/DrawerToggle';

type AdminView = 'menu' | 'create' | 'manage' | 'results' | 'notify' | 'top6results';
type PhaseInput = 'regular' | 'playoff';

interface MatchDraft {
  homeTeam: string;
  awayTeam: string;
}

export default function AdminScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<AdminView>('menu');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset to menu when tab is focused
  const viewRef = React.useRef(view);
  viewRef.current = view;

  useFocusEffect(
    useCallback(() => {
      setView('menu');
      setSelectedRound(null);
      setResultSelections({});

      const onBackPress = () => {
        if (viewRef.current !== 'menu') {
          setView('menu');
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [])
  );

  // Create round state
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [matchDrafts, setMatchDrafts] = useState<MatchDraft[]>([{ homeTeam: '', awayTeam: '' }]);
  const [championshipDrafts, setChampionshipDrafts] = useState<MatchDraft[]>([{ homeTeam: '', awayTeam: '' }]);
  const [relegationDrafts, setRelegationDrafts] = useState<MatchDraft[]>([{ homeTeam: '', awayTeam: '' }]);
  const [deadline, setDeadline] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [phaseInput, setPhaseInput] = useState<PhaseInput>('regular');

  // Round number picker
  const [roundPickerVisible, setRoundPickerVisible] = useState(false);

  // Notification state
  const [notifyMessage, setNotifyMessage] = useState('');
  const [sendingNotify, setSendingNotify] = useState(false);

  // Team picker modal
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ matchIndex: number; side: 'home' | 'away'; group?: 'championship' | 'relegation' } | null>(null);

  // Results state
  const [resultSelections, setResultSelections] = useState<Record<number, '1' | 'x' | '2'>>({});
  const [resultCounts, setResultCounts] = useState<Record<number, number>>({});

  // Top 6 results state
  const [top6Slots, setTop6Slots] = useState<string[]>(['', '', '', '', '', '']);
  const [top6PickerVisible, setTop6PickerVisible] = useState(false);
  const [top6PickerSlot, setTop6PickerSlot] = useState(0);

  if (!user?.isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noAccess}>Ingen adgang</Text>
      </View>
    );
  }

  const fetchRounds = async () => {
    try {
      const [data, results] = await Promise.all([getAllRounds(), getAllResults()]);
      setRounds(data);
      const counts: Record<number, number> = {};
      results.forEach((r) => {
        counts[r.roundNumber] = r.matches.filter((m) => m.result).length;
      });
      setResultCounts(counts);
    } catch (error) {
      console.error('Error fetching rounds:', error);
    }
  };

  const navigateTo = async (target: AdminView) => {
    if (target !== 'create') {
      await fetchRounds();
    } else {
      setMatchDrafts(Array.from({ length: 6 }, () => ({ homeTeam: '', awayTeam: '' })));
      setChampionshipDrafts(Array.from({ length: 3 }, () => ({ homeTeam: '', awayTeam: '' })));
      setRelegationDrafts(Array.from({ length: 3 }, () => ({ homeTeam: '', awayTeam: '' })));
      setRoundNumber(null);
      setDeadline(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      setPhaseInput('regular');
      // Pre-fetch rounds so we know which are taken
      await fetchRounds();
    }
    setSelectedRound(null);
    setResultSelections({});
    setView(target);
  };

  // ── Team Picker ──
  const openPicker = (matchIndex: number, side: 'home' | 'away', group?: 'championship' | 'relegation') => {
    setPickerTarget({ matchIndex, side, group });
    setPickerVisible(true);
  };

  const getPickerTeams = () => {
    if (!pickerTarget) return [...SUPERLIGA_TEAMS];
    const usedTeams = new Set<string>();

    // Collect used teams from all relevant draft arrays
    const draftGroups: { drafts: MatchDraft[]; group?: 'championship' | 'relegation' }[] =
      pickerTarget.group
        ? [{ drafts: championshipDrafts, group: 'championship' }, { drafts: relegationDrafts, group: 'relegation' }]
        : [{ drafts: matchDrafts }];

    draftGroups.forEach(({ drafts, group }) => {
      drafts.forEach((d, i) => {
        const isCurrent = group === pickerTarget.group && i === pickerTarget.matchIndex;
        if (isCurrent && pickerTarget.side === 'home') {
          if (d.awayTeam) usedTeams.add(d.awayTeam);
        } else if (isCurrent && pickerTarget.side === 'away') {
          if (d.homeTeam) usedTeams.add(d.homeTeam);
        } else {
          if (d.homeTeam) usedTeams.add(d.homeTeam);
          if (d.awayTeam) usedTeams.add(d.awayTeam);
        }
      });
    });
    return [...SUPERLIGA_TEAMS].filter((t) => !usedTeams.has(t));
  };

  const selectTeam = (team: string) => {
    if (!pickerTarget) return;
    const setter = pickerTarget.group === 'championship' ? setChampionshipDrafts
      : pickerTarget.group === 'relegation' ? setRelegationDrafts
      : setMatchDrafts;
    setter((prev) => {
      const updated = [...prev];
      if (pickerTarget.side === 'home') {
        updated[pickerTarget.matchIndex] = { ...updated[pickerTarget.matchIndex], homeTeam: team };
      } else {
        updated[pickerTarget.matchIndex] = { ...updated[pickerTarget.matchIndex], awayTeam: team };
      }
      return updated;
    });
    setPickerVisible(false);
    setPickerTarget(null);
  };

  const addMatch = (group?: 'championship' | 'relegation') => {
    const setter = group === 'championship' ? setChampionshipDrafts
      : group === 'relegation' ? setRelegationDrafts
      : setMatchDrafts;
    setter((prev) => [...prev, { homeTeam: '', awayTeam: '' }]);
  };

  const removeMatch = (index: number, group?: 'championship' | 'relegation') => {
    const setter = group === 'championship' ? setChampionshipDrafts
      : group === 'relegation' ? setRelegationDrafts
      : setMatchDrafts;
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Round number helpers ──
  const usedRoundNumbers = rounds.map((r) => r.roundNumber);
  const availableRounds = Array.from({ length: 32 }, (_, i) => i + 1)
    .filter((n) => !usedRoundNumbers.includes(n));

  const onDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'ios') {
      // iOS uses mode="datetime" so we get both date and time in one picker
      if (selectedDate) {
        setDeadline(selectedDate);
      }
      setShowDatePicker(false);
      return;
    }
    // Android: first date, then time
    setShowDatePicker(false);
    if (selectedDate) {
      const updated = new Date(deadline);
      updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDeadline(updated);
      setTimeout(() => setShowTimePicker(true), 300);
    }
  };

  const onTimeChange = (_event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const updated = new Date(deadline);
      updated.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setDeadline(updated);
    }
  };

  const formatDeadline = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // ── Create Round ──
  const handleCreateRound = async () => {
    if (roundNumber === null) {
      Alert.alert('Fejl', 'Vælg et rundenummer');
      return;
    }

    const isPlayoff = phaseInput === 'playoff';

    // Strict count validation
    if (!isPlayoff) {
      const filled = matchDrafts.filter((m) => m.homeTeam && m.awayTeam);
      const empty = matchDrafts.filter((m) => !m.homeTeam || !m.awayTeam);
      if (filled.length !== 6 || empty.length > 0) {
        const missing = 6 - filled.length;
        Alert.alert('Mangler', `Du mangler at udfylde ${missing} kamp${missing > 1 ? 'e' : ''}.`);
        return;
      }
    } else {
      const filledChamp = championshipDrafts.filter((m) => m.homeTeam && m.awayTeam);
      const filledReleg = relegationDrafts.filter((m) => m.homeTeam && m.awayTeam);
      const errors: string[] = [];
      if (filledChamp.length !== 3) errors.push(`Mesterskabsspil mangler ${3 - filledChamp.length} kamp${3 - filledChamp.length > 1 ? 'e' : ''}`);
      if (filledReleg.length !== 3) errors.push(`Nedrykningsspil mangler ${3 - filledReleg.length} kamp${3 - filledReleg.length > 1 ? 'e' : ''}`);
      if (errors.length > 0) {
        Alert.alert('Mangler', errors.join('\n'));
        return;
      }
    }

    const allDrafts = isPlayoff
      ? [...championshipDrafts, ...relegationDrafts]
      : matchDrafts;
    const validMatches = allDrafts.filter((m) => m.homeTeam && m.awayTeam);

    const duplicateCheck = validMatches.find((m) => m.homeTeam === m.awayTeam);
    if (duplicateCheck) {
      Alert.alert('Fejl', `${duplicateCheck.homeTeam} kan ikke spille mod sig selv`);
      return;
    }

    setLoading(true);
    try {
      const roundNum = roundNumber;

      let matches: Match[];
      if (isPlayoff) {
        const champMatches = championshipDrafts.filter((m) => m.homeTeam && m.awayTeam);
        const relegMatches = relegationDrafts.filter((m) => m.homeTeam && m.awayTeam);
        matches = [
          ...champMatches.map((m, i) => ({
            matchId: `r${roundNum}_champ_m${i + 1}`,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            group: 'championship' as const,
          })),
          ...relegMatches.map((m, i) => ({
            matchId: `r${roundNum}_releg_m${i + 1}`,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            group: 'relegation' as const,
          })),
        ];
      } else {
        matches = validMatches.map((m, i) => ({
          matchId: `r${roundNum}_m${i + 1}`,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
        }));
      }

      await createRoundService({
        roundNumber: roundNum,
        matches,
        deadline,
        phase: isPlayoff ? 'championship' : 'regular',
      });

      Alert.alert('Succes', `Runde ${roundNum} oprettet med ${matches.length} kampe`);
      setView('menu');
    } catch (error: any) {
      Alert.alert('Fejl', error.message ?? 'Kunne ikke oprette runde');
    } finally {
      setLoading(false);
    }
  };

  // ── Manage Round ──
  const [editMatchDrafts, setEditMatchDrafts] = useState<MatchDraft[]>([]);
  const [editChampDrafts, setEditChampDrafts] = useState<MatchDraft[]>([]);
  const [editRelegDrafts, setEditRelegDrafts] = useState<MatchDraft[]>([]);
  const [editDeadline, setEditDeadline] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  const [editPhase, setEditPhase] = useState<PhaseInput>('regular');

  const handleSelectRoundForManage = (round: Round) => {
    setSelectedRound(round);
    // Populate edit state from round data
    const hasGroups = round.matches.some((m) => m.group);
    if (hasGroups) {
      setEditPhase('playoff');
      setEditChampDrafts(
        round.matches.filter((m) => m.group === 'championship').map((m) => ({ homeTeam: m.homeTeam, awayTeam: m.awayTeam }))
      );
      setEditRelegDrafts(
        round.matches.filter((m) => m.group === 'relegation').map((m) => ({ homeTeam: m.homeTeam, awayTeam: m.awayTeam }))
      );
      setEditMatchDrafts([]);
    } else {
      setEditPhase('regular');
      setEditMatchDrafts(round.matches.map((m) => ({ homeTeam: m.homeTeam, awayTeam: m.awayTeam })));
      setEditChampDrafts([]);
      setEditRelegDrafts([]);
    }
    const dl = round.deadline instanceof Date ? round.deadline
      : (round.deadline as any)?.toDate ? (round.deadline as any).toDate()
      : new Date(round.deadline as any);
    setEditDeadline(dl);
  };

  const onEditDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'ios') {
      if (selectedDate) {
        setEditDeadline(selectedDate);
      }
      setShowEditDatePicker(false);
      return;
    }
    setShowEditDatePicker(false);
    if (selectedDate) {
      const updated = new Date(editDeadline);
      updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setEditDeadline(updated);
      setTimeout(() => setShowEditTimePicker(true), 300);
    }
  };

  const onEditTimeChange = (_event: any, selectedTime?: Date) => {
    setShowEditTimePicker(false);
    if (selectedTime) {
      const updated = new Date(editDeadline);
      updated.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setEditDeadline(updated);
    }
  };

  // Edit picker helpers
  const [editPickerTarget, setEditPickerTarget] = useState<{ matchIndex: number; side: 'home' | 'away'; group?: 'championship' | 'relegation' } | null>(null);
  const [editPickerVisible, setEditPickerVisible] = useState(false);

  const getEditPickerTeams = () => {
    if (!editPickerTarget) return [...SUPERLIGA_TEAMS];
    const usedTeams = new Set<string>();

    const draftGroups: { drafts: MatchDraft[]; group?: 'championship' | 'relegation' }[] =
      editPickerTarget.group
        ? [{ drafts: editChampDrafts, group: 'championship' }, { drafts: editRelegDrafts, group: 'relegation' }]
        : [{ drafts: editMatchDrafts }];

    draftGroups.forEach(({ drafts, group }) => {
      drafts.forEach((d, i) => {
        const isCurrent = group === editPickerTarget.group && i === editPickerTarget.matchIndex;
        if (isCurrent && editPickerTarget.side === 'home') {
          if (d.awayTeam) usedTeams.add(d.awayTeam);
        } else if (isCurrent && editPickerTarget.side === 'away') {
          if (d.homeTeam) usedTeams.add(d.homeTeam);
        } else {
          if (d.homeTeam) usedTeams.add(d.homeTeam);
          if (d.awayTeam) usedTeams.add(d.awayTeam);
        }
      });
    });
    return [...SUPERLIGA_TEAMS].filter((t) => !usedTeams.has(t));
  };

  const openEditPicker = (matchIndex: number, side: 'home' | 'away', group?: 'championship' | 'relegation') => {
    setEditPickerTarget({ matchIndex, side, group });
    setEditPickerVisible(true);
  };

  const selectEditTeam = (team: string) => {
    if (!editPickerTarget) return;
    const setter = editPickerTarget.group === 'championship' ? setEditChampDrafts
      : editPickerTarget.group === 'relegation' ? setEditRelegDrafts
      : setEditMatchDrafts;
    setter((prev) => {
      const updated = [...prev];
      if (editPickerTarget.side === 'home') {
        updated[editPickerTarget.matchIndex] = { ...updated[editPickerTarget.matchIndex], homeTeam: team };
      } else {
        updated[editPickerTarget.matchIndex] = { ...updated[editPickerTarget.matchIndex], awayTeam: team };
      }
      return updated;
    });
    setEditPickerVisible(false);
    setEditPickerTarget(null);
  };

  const addEditMatch = (group?: 'championship' | 'relegation') => {
    const setter = group === 'championship' ? setEditChampDrafts
      : group === 'relegation' ? setEditRelegDrafts
      : setEditMatchDrafts;
    setter((prev) => [...prev, { homeTeam: '', awayTeam: '' }]);
  };

  const removeEditMatch = (index: number, group?: 'championship' | 'relegation') => {
    const setter = group === 'championship' ? setEditChampDrafts
      : group === 'relegation' ? setEditRelegDrafts
      : setEditMatchDrafts;
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveRound = async () => {
    if (!selectedRound) return;
    const isPlayoff = editPhase === 'playoff';

    // Strict count validation
    if (!isPlayoff) {
      const filled = editMatchDrafts.filter((m) => m.homeTeam && m.awayTeam);
      const total = editMatchDrafts.length;
      if (filled.length !== 6 || total !== 6) {
        const missing = 6 - filled.length;
        Alert.alert('Mangler', `Du mangler at udfylde ${missing} kamp${missing > 1 ? 'e' : ''}.`);
        return;
      }
    } else {
      const filledChamp = editChampDrafts.filter((m) => m.homeTeam && m.awayTeam);
      const filledReleg = editRelegDrafts.filter((m) => m.homeTeam && m.awayTeam);
      const errors: string[] = [];
      if (filledChamp.length !== 3) errors.push(`Mesterskabsspil mangler ${3 - filledChamp.length} kamp${3 - filledChamp.length > 1 ? 'e' : ''}`);
      if (filledReleg.length !== 3) errors.push(`Nedrykningsspil mangler ${3 - filledReleg.length} kamp${3 - filledReleg.length > 1 ? 'e' : ''}`);
      if (errors.length > 0) {
        Alert.alert('Mangler', errors.join('\n'));
        return;
      }
    }

    const allDrafts = isPlayoff ? [...editChampDrafts, ...editRelegDrafts] : editMatchDrafts;
    const validMatches = allDrafts.filter((m) => m.homeTeam && m.awayTeam);

    const dup = validMatches.find((m) => m.homeTeam === m.awayTeam);
    if (dup) {
      Alert.alert('Fejl', `${dup.homeTeam} kan ikke spille mod sig selv`);
      return;
    }

    setLoading(true);
    try {
      const rn = selectedRound.roundNumber;
      let matches: Match[];
      if (isPlayoff) {
        const champ = editChampDrafts.filter((m) => m.homeTeam && m.awayTeam);
        const releg = editRelegDrafts.filter((m) => m.homeTeam && m.awayTeam);
        matches = [
          ...champ.map((m, i) => ({ matchId: `r${rn}_champ_m${i + 1}`, homeTeam: m.homeTeam, awayTeam: m.awayTeam, group: 'championship' as const })),
          ...releg.map((m, i) => ({ matchId: `r${rn}_releg_m${i + 1}`, homeTeam: m.homeTeam, awayTeam: m.awayTeam, group: 'relegation' as const })),
        ];
      } else {
        matches = validMatches.map((m, i) => ({ matchId: `r${rn}_m${i + 1}`, homeTeam: m.homeTeam, awayTeam: m.awayTeam }));
      }

      await updateRound(rn, {
        matches,
        deadline: editDeadline,
        phase: isPlayoff ? 'championship' : 'regular',
      });

      Alert.alert('Succes', `Runde ${rn} er opdateret`);
      setSelectedRound(null);
      await fetchRounds();
    } catch (error: any) {
      Alert.alert('Fejl', error.message ?? 'Kunne ikke opdatere runde');
    } finally {
      setLoading(false);
    }
  };

  // ── Results ──
  const handleSelectRoundForResults = async (round: Round) => {
    setSelectedRound(round);
    setResultSelections({});
    // Load existing results if any
    try {
      const existing = await getRoundResult(round.roundNumber);
      if (existing) {
        const map: Record<number, '1' | 'x' | '2'> = {};
        existing.matches.forEach((m, i) => {
          map[i] = m.result;
        });
        setResultSelections(map);
      }
    } catch (error) {
      // No existing results, that's fine
    }
  };

  const handleSubmitResults = async () => {
    if (!selectedRound) return;
    const filledCount = selectedRound.matches.filter((_, i) => resultSelections[i]).length;
    if (filledCount === 0) {
      Alert.alert('Ingen resultater', 'Vælg mindst ét resultat at gemme');
      return;
    }

    setLoading(true);
    try {
      const matches: MatchResult[] = selectedRound.matches.map((m, i) => ({
        matchId: m.matchId ?? `r${selectedRound.roundNumber}_m${i + 1}`,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        result: resultSelections[i] ?? '',
      }));

      const allFilled = filledCount === selectedRound.matches.length;

      await submitResultsService({
        roundNumber: selectedRound.roundNumber,
        matches,
        finishRound: allFilled,
      });

      if (allFilled) {
        Alert.alert('Succes', `Alle resultater for runde ${selectedRound.roundNumber} gemt og runden er afsluttet`);
        setSelectedRound(null);
        setResultSelections({});
        setView('menu');
      } else {
        Alert.alert('Gemt', `${filledCount} af ${selectedRound.matches.length} resultater gemt. Du kan tilføje resten senere.`);
      }
    } catch (error: any) {
      Alert.alert('Fejl', error.message);
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'open': return { text: 'Åben', color: Colors.success };
      case 'closed': return { text: 'Lukket', color: Colors.warning };
      case 'finished': return { text: 'Afsluttet', color: Colors.textSecondary };
      default: return { text: status, color: Colors.textSecondary };
    }
  };

  // Status til "Indtast resultater" – samme logik som under Runder
  const getResultStatus = (round: Round) => {
    const deadlineDate = round.deadline instanceof Date ? round.deadline
      : (round.deadline as any)?.toDate ? (round.deadline as any).toDate()
      : new Date(round.deadline as any);
    if (!(new Date() > deadlineDate)) return { text: 'Åben', color: Colors.success };
    const count = resultCounts[round.roundNumber] ?? 0;
    if (count >= round.matches.length) return { text: 'Afsluttet', color: Colors.textSecondary };
    return { text: 'Igangværende', color: Colors.warning };
  };

  const phaseLabel = (phase: string) => {
    switch (phase) {
      case 'regular': return 'Grundspil';
      case 'championship': return 'Mesterskabsspil';
      case 'relegation': return 'Nedrykningsspil';
      default: return phase;
    }
  };

  const tipOptions: ('1' | 'x' | '2')[] = ['1', 'x', '2'];

  const tipLabel = (opt: '1' | 'x' | '2', match: { homeTeam: string; awayTeam: string }) => {
    if (opt === '1') return match.homeTeam;
    if (opt === '2') return match.awayTeam;
    return 'Uafgjort';
  };

  // ═══════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>🔑 Admin</Text>
          <DrawerToggle />
        </View>
        {view !== 'menu' && (
          <TouchableOpacity onPress={() => setView('menu')}>
            <Text style={styles.backButton}>← Tilbage</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── MENU ── */}
      {view === 'menu' && (
        <View style={styles.content}>
          <TouchableOpacity style={styles.menuCard} onPress={() => navigateTo('create')}>
            <Text style={styles.menuIcon}>➕</Text>
            <View style={styles.menuCardText}>
              <Text style={styles.menuTitle}>Opret runde</Text>
              <Text style={styles.menuDesc}>Opret en ny runde med kampe</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} onPress={() => navigateTo('manage')}>
            <Text style={styles.menuIcon}>⚙️</Text>
            <View style={styles.menuCardText}>
              <Text style={styles.menuTitle}>Administrer runder</Text>
              <Text style={styles.menuDesc}>Åbn, luk eller rediger runder</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} onPress={() => navigateTo('results')}>
            <Text style={styles.menuIcon}>📊</Text>
            <View style={styles.menuCardText}>
              <Text style={styles.menuTitle}>Indtast resultater</Text>
              <Text style={styles.menuDesc}>Vælg en runde og indtast kampresultater</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} onPress={() => { setNotifyMessage(''); setView('notify'); }}>
            <Text style={styles.menuIcon}>🔔</Text>
            <View style={styles.menuCardText}>
              <Text style={styles.menuTitle}>Send notifikation</Text>
              <Text style={styles.menuDesc}>Send besked til alle brugere</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} onPress={async () => {
            const existing = await getTop6Result();
            if (existing) setTop6Slots(existing.teams);
            else setTop6Slots(['', '', '', '', '', '']);
            setView('top6results');
          }}>
            <Text style={styles.menuIcon}>⭐</Text>
            <View style={styles.menuCardText}>
              <Text style={styles.menuTitle}>Top 6 resultat</Text>
              <Text style={styles.menuDesc}>Indtast den endelige Top 6 stilling</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* ── TEAM PICKER MODAL ── */}
      <Modal visible={pickerVisible} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Vælg hold</Text>
            <FlatList
              data={getPickerTeams()}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => selectTeam(item)}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => { setPickerVisible(false); setPickerTarget(null); }}
            >
              <Text style={styles.modalCancelText}>Annuller</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── CREATE ROUND ── */}
      {view === 'create' && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Opret ny runde</Text>

          <Text style={styles.label}>Rundenummer</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setRoundPickerVisible(true)}
          >
            <Text style={roundNumber !== null ? styles.pickerValueText : styles.pickerPlaceholderText}>
              {roundNumber !== null ? `Runde ${roundNumber}` : 'Vælg runde...'}
            </Text>
          </TouchableOpacity>

          {/* Round Number Picker Modal */}
          <Modal visible={roundPickerVisible} transparent animationType="slide" statusBarTranslucent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Vælg runde</Text>
                {availableRounds.length === 0 ? (
                  <Text style={[styles.modalItemText, { textAlign: 'center', padding: 20 }]}>Alle 32 runder er oprettet</Text>
                ) : (
                  <FlatList
                    data={availableRounds}
                    keyExtractor={(item) => item.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.modalItem}
                        onPress={() => { setRoundNumber(item); setRoundPickerVisible(false); }}
                      >
                        <Text style={styles.modalItemText}>Runde {item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                )}
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setRoundPickerVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Annuller</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Text style={styles.label}>Fase</Text>
          <View style={styles.phaseRow}>
            {([{ key: 'regular', label: 'Grundspil' }, { key: 'playoff', label: 'Slutspil' }] as const).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.phaseButton, phaseInput === key && styles.phaseButtonSelected]}
                onPress={() => setPhaseInput(key as PhaseInput)}
              >
                <Text style={[styles.phaseText, phaseInput === key && styles.phaseTextSelected]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Deadline</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.pickerValueText}>{formatDeadline(deadline)}</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={deadline}
              mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={onDateChange}
              onDismiss={() => setShowDatePicker(false)}
              minimumDate={new Date()}
              is24Hour={true}
              locale="da-DK"
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={deadline}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={onTimeChange}
              onDismiss={() => setShowTimePicker(false)}
              is24Hour={true}
            />
          )}

          <Text style={styles.label}>Kampe</Text>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={openSuperligaKampprogram}
          >
            <Text style={styles.linkButtonText}>🌐 Se kampprogram</Text>
          </TouchableOpacity>

          {phaseInput === 'regular' ? (
            <>
              {matchDrafts.map((draft, i) => (
                <View key={`draft-${i}`} style={styles.matchDraftCard}>
                  <Text style={styles.matchDraftLabel}>Kamp {i + 1}</Text>
                  <View style={styles.matchDraftRow}>
                    <TouchableOpacity
                      style={[styles.teamPicker, draft.homeTeam ? styles.teamPickerSelected : null]}
                      onPress={() => openPicker(i, 'home')}
                    >
                      <Text style={draft.homeTeam ? styles.teamPickerTextSelected : styles.teamPickerText}>
                        {draft.homeTeam || 'Hjemmehold'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.vsText}>vs</Text>
                    <TouchableOpacity
                      style={[styles.teamPicker, draft.awayTeam ? styles.teamPickerSelected : null]}
                      onPress={() => openPicker(i, 'away')}
                    >
                      <Text style={draft.awayTeam ? styles.teamPickerTextSelected : styles.teamPickerText}>
                        {draft.awayTeam || 'Udehold'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <>
              {/* Mesterskabsspil */}
              <View style={styles.groupHeader}>
                <Text style={styles.groupHeaderText}>🏆 Mesterskabsspil</Text>
              </View>
              {championshipDrafts.map((draft, i) => (
                <View key={`champ-${i}`} style={[styles.matchDraftCard, styles.matchDraftCardChamp]}>
                  <Text style={styles.matchDraftLabel}>Kamp {i + 1}</Text>
                  <View style={styles.matchDraftRow}>
                    <TouchableOpacity
                      style={[styles.teamPicker, draft.homeTeam ? styles.teamPickerSelected : null]}
                      onPress={() => openPicker(i, 'home', 'championship')}
                    >
                      <Text style={draft.homeTeam ? styles.teamPickerTextSelected : styles.teamPickerText}>
                        {draft.homeTeam || 'Hjemmehold'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.vsText}>vs</Text>
                    <TouchableOpacity
                      style={[styles.teamPicker, draft.awayTeam ? styles.teamPickerSelected : null]}
                      onPress={() => openPicker(i, 'away', 'championship')}
                    >
                      <Text style={draft.awayTeam ? styles.teamPickerTextSelected : styles.teamPickerText}>
                        {draft.awayTeam || 'Udehold'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* Nedrykningsspil */}
              <View style={[styles.groupHeader, { marginTop: 20 }]}>
                <Text style={styles.groupHeaderText}>⬇️ Nedrykningsspil</Text>
              </View>
              {relegationDrafts.map((draft, i) => (
                <View key={`releg-${i}`} style={[styles.matchDraftCard, styles.matchDraftCardReleg]}>
                  <Text style={styles.matchDraftLabel}>Kamp {i + 1}</Text>
                  <View style={styles.matchDraftRow}>
                    <TouchableOpacity
                      style={[styles.teamPicker, draft.homeTeam ? styles.teamPickerSelected : null]}
                      onPress={() => openPicker(i, 'home', 'relegation')}
                    >
                      <Text style={draft.homeTeam ? styles.teamPickerTextSelected : styles.teamPickerText}>
                        {draft.homeTeam || 'Hjemmehold'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.vsText}>vs</Text>
                    <TouchableOpacity
                      style={[styles.teamPicker, draft.awayTeam ? styles.teamPickerSelected : null]}
                      onPress={() => openPicker(i, 'away', 'relegation')}
                    >
                      <Text style={draft.awayTeam ? styles.teamPickerTextSelected : styles.teamPickerText}>
                        {draft.awayTeam || 'Udehold'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleCreateRound}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={Colors.white} /> :
              <Text style={styles.buttonText}>Opret runde</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* ── MANAGE ROUNDS ── */}
      {view === 'manage' && !selectedRound && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Vælg runde</Text>
          {rounds.length === 0 && (
            <Text style={styles.emptyText}>Ingen runder oprettet endnu</Text>
          )}
          {rounds.map((round, i) => {
            const st = statusLabel(round.status);
            const isFinished = round.status === 'finished';
            return (
              <TouchableOpacity
                key={`manage-${i}`}
                style={[styles.roundCard, isFinished && { opacity: 0.5 }]}
                onPress={() => !isFinished && handleSelectRoundForManage(round)}
                disabled={isFinished}
              >
                <View style={styles.roundCardHeader}>
                  <Text style={styles.roundCardTitle}>Runde {round.roundNumber}</Text>
                  <View style={[styles.badge, { backgroundColor: st.color }]}>
                    <Text style={styles.badgeText}>{st.text}</Text>
                  </View>
                </View>
                <Text style={styles.roundCardSub}>
                  {round.matches.length} kampe · {phaseLabel(round.phase)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {view === 'manage' && selectedRound && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Rediger runde {selectedRound.roundNumber}</Text>

          {/* Edit Team Picker Modal */}
          <Modal visible={editPickerVisible} transparent animationType="slide" statusBarTranslucent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Vælg hold</Text>
                <FlatList
                  data={getEditPickerTeams()}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.modalItem} onPress={() => selectEditTeam(item)}>
                      <Text style={styles.modalItemText}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
                <TouchableOpacity style={styles.modalCancel} onPress={() => { setEditPickerVisible(false); setEditPickerTarget(null); }}>
                  <Text style={styles.modalCancelText}>Annuller</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Text style={styles.label}>Fase</Text>
          <View style={styles.phaseRow}>
            {([{ key: 'regular', label: 'Grundspil' }, { key: 'playoff', label: 'Slutspil' }] as const).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.phaseButton, editPhase === key && styles.phaseButtonSelected]}
                onPress={() => setEditPhase(key as PhaseInput)}
              >
                <Text style={[styles.phaseText, editPhase === key && styles.phaseTextSelected]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Deadline</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowEditDatePicker(true)}>
            <Text style={styles.pickerValueText}>{formatDeadline(editDeadline)}</Text>
          </TouchableOpacity>
          {showEditDatePicker && (
            <DateTimePicker
              value={editDeadline}
              mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={onEditDateChange}
              onDismiss={() => setShowEditDatePicker(false)}
              is24Hour={true}
              locale="da-DK"
            />
          )}
          {showEditTimePicker && (
            <DateTimePicker
              value={editDeadline}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={onEditTimeChange}
              onDismiss={() => setShowEditTimePicker(false)}
              is24Hour={true}
            />
          )}

          <Text style={styles.label}>Kampe</Text>
          {editPhase === 'regular' ? (
            <>
              {editMatchDrafts.map((draft, i) => (
                <View key={`edit-${i}`} style={styles.matchDraftCard}>
                  <Text style={styles.matchDraftLabel}>Kamp {i + 1}</Text>
                  <View style={styles.matchDraftRow}>
                    <TouchableOpacity
                      style={[styles.teamPicker, draft.homeTeam ? styles.teamPickerSelected : null]}
                      onPress={() => openEditPicker(i, 'home')}
                    >
                      <Text style={draft.homeTeam ? styles.teamPickerTextSelected : styles.teamPickerText}>
                        {draft.homeTeam || 'Hjemmehold'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.vsText}>vs</Text>
                    <TouchableOpacity
                      style={[styles.teamPicker, draft.awayTeam ? styles.teamPickerSelected : null]}
                      onPress={() => openEditPicker(i, 'away')}
                    >
                      <Text style={draft.awayTeam ? styles.teamPickerTextSelected : styles.teamPickerText}>
                        {draft.awayTeam || 'Udehold'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {editMatchDrafts.length > 1 && (
                    <TouchableOpacity onPress={() => removeEditMatch(i)} style={styles.removeMatch}>
                      <Text style={styles.removeMatchText}>Fjern kamp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.addMatchButton} onPress={() => addEditMatch()}>
                <Text style={styles.addMatchText}>+ Tilføj kamp</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.groupHeader}>
                <Text style={styles.groupHeaderText}>🏆 Mesterskabsspil</Text>
              </View>
              {editChampDrafts.map((draft, i) => (
                <View key={`edit-champ-${i}`} style={[styles.matchDraftCard, styles.matchDraftCardChamp]}>
                  <Text style={styles.matchDraftLabel}>Kamp {i + 1}</Text>
                  <View style={styles.matchDraftRow}>
                    <TouchableOpacity
                      style={[styles.teamPicker, draft.homeTeam ? styles.teamPickerSelected : null]}
                      onPress={() => openEditPicker(i, 'home', 'championship')}
                    >
                      <Text style={draft.homeTeam ? styles.teamPickerTextSelected : styles.teamPickerText}>
                        {draft.homeTeam || 'Hjemmehold'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.vsText}>vs</Text>
                    <TouchableOpacity
                      style={[styles.teamPicker, draft.awayTeam ? styles.teamPickerSelected : null]}
                      onPress={() => openEditPicker(i, 'away', 'championship')}
                    >
                      <Text style={draft.awayTeam ? styles.teamPickerTextSelected : styles.teamPickerText}>
                        {draft.awayTeam || 'Udehold'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {editChampDrafts.length > 1 && (
                    <TouchableOpacity onPress={() => removeEditMatch(i, 'championship')} style={styles.removeMatch}>
                      <Text style={styles.removeMatchText}>Fjern kamp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.addMatchButton} onPress={() => addEditMatch('championship')}>
                <Text style={styles.addMatchText}>+ Tilføj kamp</Text>
              </TouchableOpacity>

              <View style={[styles.groupHeader, { marginTop: 20 }]}>
                <Text style={styles.groupHeaderText}>⬇️ Nedrykningsspil</Text>
              </View>
              {editRelegDrafts.map((draft, i) => (
                <View key={`edit-releg-${i}`} style={[styles.matchDraftCard, styles.matchDraftCardReleg]}>
                  <Text style={styles.matchDraftLabel}>Kamp {i + 1}</Text>
                  <View style={styles.matchDraftRow}>
                    <TouchableOpacity
                      style={[styles.teamPicker, draft.homeTeam ? styles.teamPickerSelected : null]}
                      onPress={() => openEditPicker(i, 'home', 'relegation')}
                    >
                      <Text style={draft.homeTeam ? styles.teamPickerTextSelected : styles.teamPickerText}>
                        {draft.homeTeam || 'Hjemmehold'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.vsText}>vs</Text>
                    <TouchableOpacity
                      style={[styles.teamPicker, draft.awayTeam ? styles.teamPickerSelected : null]}
                      onPress={() => openEditPicker(i, 'away', 'relegation')}
                    >
                      <Text style={draft.awayTeam ? styles.teamPickerTextSelected : styles.teamPickerText}>
                        {draft.awayTeam || 'Udehold'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {editRelegDrafts.length > 1 && (
                    <TouchableOpacity onPress={() => removeEditMatch(i, 'relegation')} style={styles.removeMatch}>
                      <Text style={styles.removeMatchText}>Fjern kamp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.addMatchButton} onPress={() => addEditMatch('relegation')}>
                <Text style={styles.addMatchText}>+ Tilføj kamp</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.button, styles.buttonSuccess, loading && styles.buttonDisabled]}
            onPress={handleSaveRound}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={Colors.white} /> :
              <Text style={styles.buttonText}>Gem ændringer</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { marginTop: 8, backgroundColor: Colors.textSecondary }]}
            onPress={() => setSelectedRound(null)}
          >
            <Text style={styles.buttonText}>Vælg anden runde</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── RESULTS ── */}
      {view === 'results' && !selectedRound && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Vælg runde til resultater</Text>
          {rounds.length === 0 && (
            <Text style={styles.emptyText}>Ingen runder oprettet endnu</Text>
          )}
          {rounds.map((round, i) => {
            const st = getResultStatus(round);
            return (
              <TouchableOpacity
                key={`result-${i}`}
                style={styles.roundCard}
                onPress={() => handleSelectRoundForResults(round)}
              >
                <View style={styles.roundCardHeader}>
                  <Text style={styles.roundCardTitle}>Runde {round.roundNumber}</Text>
                  <View style={[styles.badge, { backgroundColor: st.color }]}>
                    <Text style={styles.badgeText}>{st.text}</Text>
                  </View>
                </View>
                <Text style={styles.roundCardSub}>
                  {round.matches.length} kampe · {phaseLabel(round.phase)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {view === 'results' && selectedRound && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>
            Resultater — Runde {selectedRound.roundNumber}
          </Text>

          {(() => {
            const hasGroups = selectedRound.matches.some((m) => m.group);
            if (hasGroups) {
              const champMatches = selectedRound.matches
                .map((m, i) => ({ match: m, originalIndex: i }))
                .filter(({ match }) => match.group === 'championship');
              const relegMatches = selectedRound.matches
                .map((m, i) => ({ match: m, originalIndex: i }))
                .filter(({ match }) => match.group === 'relegation');
              return (
                <>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupHeaderText}>🏆 Mesterskabsspil</Text>
                  </View>
                  {champMatches.map(({ match, originalIndex: i }) => (
                    <View key={`res-champ-${i}`} style={styles.resultMatchCard}>
                      <Text style={styles.resultMatchText}>
                        {match.homeTeam} - {match.awayTeam}
                      </Text>
                      <View style={styles.resultRow}>
                        {tipOptions.map((opt) => (
                          <TouchableOpacity
                            key={`res-${i}-${opt}`}
                            style={[styles.resultButton, resultSelections[i] === opt && styles.resultButtonSelected]}
                            onPress={() => setResultSelections((prev) => ({ ...prev, [i]: opt }))}
                          >
                            <Text style={[styles.resultButtonText, resultSelections[i] === opt && styles.resultButtonTextSelected]}>
                              {tipLabel(opt, match)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                  <View style={[styles.groupHeader, { marginTop: 16 }]}>
                    <Text style={styles.groupHeaderText}>⬇️ Nedrykningsspil</Text>
                  </View>
                  {relegMatches.map(({ match, originalIndex: i }) => (
                    <View key={`res-releg-${i}`} style={styles.resultMatchCard}>
                      <Text style={styles.resultMatchText}>
                        {match.homeTeam} - {match.awayTeam}
                      </Text>
                      <View style={styles.resultRow}>
                        {tipOptions.map((opt) => (
                          <TouchableOpacity
                            key={`res-${i}-${opt}`}
                            style={[styles.resultButton, resultSelections[i] === opt && styles.resultButtonSelected]}
                            onPress={() => setResultSelections((prev) => ({ ...prev, [i]: opt }))}
                          >
                            <Text style={[styles.resultButtonText, resultSelections[i] === opt && styles.resultButtonTextSelected]}>
                              {tipLabel(opt, match)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </>
              );
            }
            return selectedRound.matches.map((match, i) => (
              <View key={`res-match-${i}`} style={styles.resultMatchCard}>
                <Text style={styles.resultMatchText}>
                  {match.homeTeam} - {match.awayTeam}
                </Text>
                <View style={styles.resultRow}>
                  {tipOptions.map((opt) => (
                    <TouchableOpacity
                      key={`res-${i}-${opt}`}
                      style={[styles.resultButton, resultSelections[i] === opt && styles.resultButtonSelected]}
                      onPress={() => setResultSelections((prev) => ({ ...prev, [i]: opt }))}
                    >
                      <Text style={[styles.resultButtonText, resultSelections[i] === opt && styles.resultButtonTextSelected]}>
                        {tipLabel(opt, match)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ));
          })()}

          <TouchableOpacity
            style={[styles.button, styles.buttonSuccess, loading && styles.buttonDisabled]}
            onPress={handleSubmitResults}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={Colors.white} /> :
              <Text style={styles.buttonText}>Gem resultater</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { marginTop: 8, backgroundColor: Colors.textSecondary }]}
            onPress={() => { setSelectedRound(null); setResultSelections({}); }}
          >
            <Text style={styles.buttonText}>Vælg anden runde</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── SEND NOTIFICATION ── */}
      {view === 'notify' && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Send notifikation</Text>
          <Text style={styles.emptyText}>Beskeden sendes til alle brugere med appen installeret.</Text>
          <Text style={[styles.emptyText, { marginTop: 4, marginBottom: 16 }]}>Brugeren skal have været logget ind mindst én gang for at modtage notifikationer.</Text>
          <TextInput
            style={styles.notifyInput}
            placeholder="Skriv din besked her..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            value={notifyMessage}
            onChangeText={setNotifyMessage}
          />
          <TouchableOpacity
            style={[styles.button, sendingNotify && styles.buttonDisabled, !notifyMessage.trim() && styles.buttonDisabled]}
            disabled={sendingNotify || !notifyMessage.trim()}
            onPress={async () => {
              setSendingNotify(true);
              try {
                const result = await sendPushNotificationToAll('Familietipsklubben', notifyMessage.trim());
                const nameList = result.names.join(', ');
                Alert.alert(
                  'Sendt!',
                  result.success > 0
                    ? `Notifikation sendt til ${result.success} personer:\n${nameList}${result.failed > 0 ? `\n\n${result.failed} fejlede.` : ''}`
                    : 'Ingen brugere har registreret push token endnu. De skal logge ind mindst én gang.',
                );
                setNotifyMessage('');
              } catch (error: any) {
                Alert.alert('Fejl', error.message ?? 'Kunne ikke sende notifikation');
              } finally {
                setSendingNotify(false);
              }
            }}
          >
            {sendingNotify ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.buttonText}>Send til alle brugere</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── TOP 6 RESULTS ── */}
      {view === 'top6results' && (() => {
        const usedTeams = new Set(top6Slots.filter(Boolean));
        const availableTeams = SUPERLIGA_TEAMS.filter((t) => !usedTeams.has(t));
        const allFilled = top6Slots.every(Boolean);

        return (
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Top 6 resultat</Text>
            <Text style={styles.emptyText}>Indtast den endelige Top 6 i Superligaen</Text>

            {top6Slots.map((team, i) => (
              <TouchableOpacity
                key={i}
                style={styles.top6SlotRow}
                onPress={() => { setTop6PickerSlot(i); setTop6PickerVisible(true); }}
              >
                <Text style={styles.top6SlotNumber}>{i + 1}.</Text>
                <View style={[styles.top6SlotBox, team ? styles.top6SlotFilled : styles.top6SlotEmpty]}>
                  <Text style={team ? styles.top6SlotTeam : styles.top6SlotPlaceholder}>
                    {team || 'Vælg hold...'}
                  </Text>
                </View>
                {team ? (
                  <TouchableOpacity onPress={() => {
                    const updated = [...top6Slots];
                    updated[i] = '';
                    setTop6Slots(updated);
                  }}>
                    <Text style={styles.top6RemoveBtn}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.button, !allFilled && styles.buttonDisabled, { marginTop: 16 }]}
              disabled={!allFilled || loading}
              onPress={async () => {
                setLoading(true);
                try {
                  await submitTop6Result(top6Slots);
                  Alert.alert('Gemt!', 'Top 6 resultat er registreret ✅');
                  setView('menu');
                } catch (e: any) {
                  Alert.alert('Fejl', e.message ?? 'Kunne ikke gemme');
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Text style={styles.buttonText}>Gem Top 6 resultat</Text>
            </TouchableOpacity>

            <Modal visible={top6PickerVisible} transparent animationType="slide" statusBarTranslucent>
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Vælg hold til plads {top6PickerSlot + 1}</Text>
                  <FlatList
                    data={availableTeams}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.modalItem}
                        onPress={() => {
                          const updated = [...top6Slots];
                          updated[top6PickerSlot] = item;
                          setTop6Slots(updated);
                          setTop6PickerVisible(false);
                        }}
                      >
                        <Text style={styles.modalItemText}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setTop6PickerVisible(false)}>
                    <Text style={styles.modalCancelText}>Annuller</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
        );
      })()}

      <View style={{ height: 40 }} />
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
  },
  noAccess: {
    fontSize: 18,
    color: Colors.error,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
  backButton: {
    color: Colors.secondary,
    fontSize: 16,
    marginTop: 8,
    fontWeight: '500',
  },
  content: {
    padding: 16,
  },

  // Menu
  menuCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  menuCardText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  menuDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Sections
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 20,
  },

  // Inputs
  input: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerValueText: {
    fontSize: 16,
    color: Colors.text,
  },
  pickerPlaceholderText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },

  // Match drafts (team picker)
  matchDraftCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  matchDraftCardChamp: {
    borderLeftWidth: 4,
    borderLeftColor: '#d4a017',
  },
  matchDraftCardReleg: {
    borderLeftWidth: 4,
    borderLeftColor: '#c0392b',
  },
  groupHeader: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  groupHeaderText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  matchDraftLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  matchDraftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamPicker: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  teamPickerSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#eef0f8',
  },
  teamPickerText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  teamPickerTextSelected: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  removeMatch: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  removeMatchText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '500',
  },
  addMatchButton: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 4,
  },
  addMatchText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingTop: 20,
    paddingBottom: 0,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalItem: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalItemText: {
    fontSize: 16,
    color: Colors.text,
  },
  modalCancel: {
    paddingVertical: 16,
    paddingBottom: 32,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
  },

  // Phase selector
  phaseRow: {
    flexDirection: 'row',
    gap: 8,
  },
  phaseButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  phaseButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  phaseText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  phaseTextSelected: {
    color: Colors.white,
  },

  // Kampprogram link
  linkButton: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  linkButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // Round cards
  roundCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roundCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roundCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  roundCardSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
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

  // Detail card
  detailCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
    marginTop: 2,
  },
  detailMatch: {
    fontSize: 15,
    color: Colors.text,
    marginTop: 4,
  },

  // Result match cards
  resultMatchCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  resultMatchText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 10,
  },
  resultRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resultButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  resultButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  resultButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  resultButtonTextSelected: {
    color: Colors.white,
  },

  // Buttons
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  notifyInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    minHeight: 120,
    marginBottom: 16,
  },
  buttonWarning: {
    backgroundColor: Colors.warning,
  },
  buttonSuccess: {
    backgroundColor: Colors.success,
  },
  buttonDanger: {
    backgroundColor: Colors.error,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  top6SlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  top6SlotNumber: {
    width: 28,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  top6SlotBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  top6SlotFilled: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryLight,
  },
  top6SlotEmpty: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  top6SlotTeam: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  top6SlotPlaceholder: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  top6RemoveBtn: {
    marginLeft: 8,
    fontSize: 16,
    color: Colors.error,
    fontWeight: '700',
    padding: 6,
  },
});
