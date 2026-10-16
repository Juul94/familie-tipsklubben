import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../constants/Colors';
import DrawerToggle from '../components/DrawerToggle';

const prizeDistribution = [
  { place: '1.', amount: '🥇 Guld' },
  { place: '2.', amount: '🥈 Sølv' },
  { place: '3.', amount: '🥉 Bronze' },
  { place: '4.', amount: '⭐ Hæder' },
];

export default function PoolScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>🏆 Konkurrence</Text>
          <DrawerToggle />
        </View>
      </View>

      <View style={styles.content}>
        {/* Deltagelse */}
        <View style={styles.card}>
          <Text style={styles.cardIcon}>🎟️</Text>
          <Text style={styles.cardTitle}>Deltagelse</Text>
          <Text style={styles.cardDescription}>
            Alle familiemedlemmer kan deltage i konkurrencen. Tip på hver runde og saml point!
          </Text>
        </View>

        {/* Straf */}
        <View style={styles.card}>
          <Text style={styles.cardIcon}>⚠️</Text>
          <Text style={styles.cardTitle}>Nul rigtige</Text>
          <Text style={styles.cardDescription}>
            Får du nul rigtige i en runde, får du en ekstra udfordring til afslutningsdagen!
          </Text>
        </View>

        {/* Præmiefordeling */}
        <View style={styles.card}>
          <Text style={styles.cardIcon}>🏆</Text>
          <Text style={styles.cardTitle}>Præmiefordeling</Text>
          <View style={styles.prizeList}>
            {prizeDistribution.map((prize, index) => (
              <View key={index} style={styles.prizeRow}>
                <Text style={styles.prizePlace}>{prize.place}</Text>
                <View style={styles.prizeDots} />
                <Text style={styles.prizeAmount}>{prize.amount}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Lodtrækning */}
        <View style={styles.card}>
          <Text style={styles.cardIcon}>🎲</Text>
          <Text style={styles.cardTitle}>Lodtrækning</Text>
          <Text style={styles.cardDescription}>
            På afslutningsdagen trækkes der lod om en overraskelse blandt alle deltagere uden for top 4, som er til stede.
          </Text>
        </View>
      </View>
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
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  prizeList: {
    marginTop: 4,
    gap: 10,
  },
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prizePlace: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    width: 30,
  },
  prizeDots: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    marginHorizontal: 8,
  },
  prizeAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.secondary,
  },
});
