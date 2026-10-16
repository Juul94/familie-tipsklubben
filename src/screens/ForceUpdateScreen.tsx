import React from 'react';
import { Text, StyleSheet, TouchableOpacity, Linking, Platform, ScrollView } from 'react-native';
import { Colors } from '../constants/Colors';

// Store URLs for the force-update screen
const ANDROID_URL = process.env.EXPO_PUBLIC_ANDROID_STORE_URL ?? '';
const IOS_URL = process.env.EXPO_PUBLIC_IOS_STORE_URL ?? '';

interface Props {
  currentVersion: string;
  requiredVersion: string;
}

export default function ForceUpdateScreen({ currentVersion, requiredVersion }: Props) {
  const storeUrl = Platform.OS === 'ios' ? IOS_URL : ANDROID_URL;
  const storeName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.icon}>🔄</Text>
      <Text style={styles.title}>Opdatering påkrævet</Text>
      <Text style={styles.message}>
        En ny version af Familietipsklubben er tilgængelig. Du skal opdatere appen for at fortsætte.
      </Text>
      <Text style={styles.versionInfo}>
        Din version: {currentVersion}{'\n'}
        Ny version: {requiredVersion}
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => Linking.openURL(storeUrl)}
      >
        <Text style={styles.buttonText}>Opdater via {storeName}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  versionInfo: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
