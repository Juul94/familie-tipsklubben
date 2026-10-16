import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import DrawerToggle from '../components/DrawerToggle';

const ADMIN_NAME = process.env.EXPO_PUBLIC_ADMIN_NAME ?? 'admin';
const ADMIN_PHONE = process.env.EXPO_PUBLIC_ADMIN_PHONE ?? '';

const rules = [
  {
    icon: '⏰',
    title: 'Glemt at tippe?',
    description:
      'Hvis du ikke når at tippe inden deadline, bliver dine manglende kampe automatisk registreret som uafgjort.',
    extra:
      `Ønsker du at ændre dem, kan du sende en SMS til ${ADMIN_NAME} på`,
    phone: true,
  },
  {
    icon: '🔒',
    title: 'Låste tips',
    description:
      'Når du har indsendt dine tips, kan de ikke ændres. Deadline for ændringer er kl. 23:59 dagen før første kamp i runden spilles.',
  },
];

export default function RulesScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>📜 Regler</Text>
          <DrawerToggle />
        </View>
      </View>

      <View style={styles.content}>
        {rules.map((rule, index) => (
          <View key={index} style={styles.card}>
            <Text style={styles.ruleIcon}>{rule.icon}</Text>
            <Text style={styles.ruleTitle}>{rule.title}</Text>
            <Text style={styles.ruleDescription}>{rule.description}</Text>
            {rule.extra && (
              <Text style={[styles.ruleDescription, { marginTop: 8 }]}>
                {rule.extra}{' '}
                {rule.phone && (
                  <Text
                    style={styles.phoneLink}
                    onPress={() =>
                      Linking.openURL(`sms:${ADMIN_PHONE}`)
                    }
                  >
                    {ADMIN_PHONE}
                  </Text>
                )}
                {rule.phone && '. Bemærk: dette kan kun lade sig gøre, hvis kampen endnu ikke er startet.'}
              </Text>
            )}
          </View>
        ))}
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
  ruleIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  ruleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  ruleDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  phoneLink: {
    color: Colors.secondary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
