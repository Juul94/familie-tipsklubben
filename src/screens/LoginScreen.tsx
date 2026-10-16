import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';

const DARK_BLUE = '#13162b';
const GREEN = '#cadd65';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleForgotPassword = async () => {
    const target = resetEmail.trim() || email.trim();
    if (!target) {
      Alert.alert('Fejl', 'Indtast din email.');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, target);
      Alert.alert('Email sendt', 'Der kan gå op til 10 minutter. Tjek din spam/junk mappe, da mailen højst sandsynligt ender der.');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch {
      Alert.alert('Fejl', 'Kunne ikke sende email. Tjek at emailen er korrekt.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Fejl', 'Indtast email og adgangskode');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (error: any) {
      Alert.alert('Login fejl', error.message ?? 'Ukendt fejl');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require('../../assets/familie-tipsklubben-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Adgangskode"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="password"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#999" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Log ind</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.forgotButton}
          onPress={() => { setResetEmail(email); setShowForgotPassword(!showForgotPassword); }}
        >
          <Text style={styles.forgotText}>Glemt kodeord?</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>v{Constants.expoConfig?.version}</Text>

        {showForgotPassword && (
          <View style={styles.forgotContainer}>
            <Text style={styles.forgotDescription}>
              Indtast din email, så sender vi et link til at nulstille dit kodeord.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={resetEmail}
              onChangeText={setResetEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity
              style={[styles.resetButton, resetLoading && styles.buttonDisabled]}
              onPress={handleForgotPassword}
              disabled={resetLoading}
            >
              {resetLoading ? (
                <ActivityIndicator color={DARK_BLUE} />
              ) : (
                <Text style={styles.resetButtonText}>Send nulstillingslink</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  logo: {
    width: '100%',
    height: 120,
    alignSelf: 'center',
    marginBottom: 48,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
    color: DARK_BLUE,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: DARK_BLUE,
  },
  eyeButton: {
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  button: {
    backgroundColor: DARK_BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: GREEN,
    fontSize: 18,
    fontWeight: '600',
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotText: {
    color: '#666',
    fontSize: 14,
  },
  versionText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  forgotContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  forgotDescription: {
    color: '#666',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetButtonText: {
    color: DARK_BLUE,
    fontSize: 16,
    fontWeight: '600',
  },
});
