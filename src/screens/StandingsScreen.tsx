import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { calculateStandings } from '../services/firestoreService';
import { StandingEntry } from '../types';
import { Colors } from '../constants/Colors';
import DrawerToggle from '../components/DrawerToggle';

export default function StandingsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStandings = async () => {
    try {
      const data = await calculateStandings();
      setStandings(data);
    } catch (error) {
      console.error('Error calculating standings:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadStandings();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStandings();
    setRefreshing(false);
  };

  const renderItem = ({ item, index }: { item: StandingEntry; index: number }) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index === 3 ? '🏅' : null;
    const roundsPlayed = Object.keys(item.roundPoints).length;

    return (
      <TouchableOpacity
        style={[styles.row, index < 4 && styles.topRow]}
        onPress={() => navigation.navigate('Statistikker', { userId: item.userId })}
        activeOpacity={0.6}
      >
        <View style={styles.rankContainer}>
          {medal ? (
            <Text style={styles.medal}>{medal}</Text>
          ) : (
            <Text style={styles.rank}>{index + 1}.</Text>
          )}
        </View>
        <View style={styles.nameContainer}>
          <Text style={styles.name}>{item.userName}</Text>
          <Text style={styles.roundsPlayed}>{roundsPlayed} {roundsPlayed === 1 ? 'runde' : 'runder'} spillet</Text>
        </View>
        <View style={styles.pointsContainer}>
          <Text style={styles.points}>
            {item.totalPoints - item.top6Points}
            {item.top6Points > 0 ? <Text style={styles.top6Bonus}> +{item.top6Points}</Text> : null}
          </Text>
          <Text style={styles.pointsLabel}>
            {item.top6Points > 0 ? `= ${item.totalPoints} point` : 'point'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>🏆 Stilling</Text>
          <DrawerToggle />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={standings}
          keyExtractor={(item) => item.userId}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.empty}>Ingen resultater endnu</Text>
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
  },

  list: {
    padding: 16,
    paddingTop: 16,
  },
  row: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topRow: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.secondary,
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  medal: {
    fontSize: 22,
  },
  rank: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  nameContainer: {
    flex: 1,
    marginLeft: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  roundsPlayed: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pointsContainer: {
    alignItems: 'center',
    minWidth: 50,
  },
  points: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
  },
  top6Bonus: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.secondary,
  },
  pointsLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  empty: {
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: 40,
    fontSize: 16,
  },
});
