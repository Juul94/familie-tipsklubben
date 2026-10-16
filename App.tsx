import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import ForceUpdateScreen from './src/screens/ForceUpdateScreen';
import { getMinRequiredVersion } from './src/services/firestoreService';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

function compareVersions(current: string, required: string): boolean {
  const c = current.split('.').map(Number);
  const r = required.split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, r.length); i++) {
    const cv = c[i] ?? 0;
    const rv = r[i] ?? 0;
    if (cv < rv) return true;  // needs update
    if (cv > rv) return false;
  }
  return false;
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const [updateRequired, setUpdateRequired] = useState(false);
  const [requiredVersion, setRequiredVersion] = useState('');
  const [checkingVersion, setCheckingVersion] = useState(true);

  useEffect(() => {
    getMinRequiredVersion()
      .then((minVersion) => {
        if (minVersion && compareVersions(APP_VERSION, minVersion)) {
          setRequiredVersion(minVersion);
          setUpdateRequired(true);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingVersion(false));
  }, []);

  if (loading || checkingVersion) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1B4D3E" />
      </View>
    );
  }

  if (updateRequired) {
    return <ForceUpdateScreen currentVersion={APP_VERSION} requiredVersion={requiredVersion} />;
  }

  return user ? <AppNavigator /> : <LoginScreen />;
}

export const navigationRef = React.createRef<NavigationContainerRef<any>>();

function handleNotificationNavigation(data: any) {
  if (data?.type === 'chat_message') {
    // Wait for navigation to be ready, then navigate
    const tryNavigate = (retries = 0) => {
      if (navigationRef.current?.isReady()) {
        navigationRef.current.navigate('Chat');
      } else if (retries < 10) {
        setTimeout(() => tryNavigate(retries + 1), 300);
      }
    };
    tryNavigate();
  }
}

export default function App() {
  useEffect(() => {
    let subscription: any;
    try {
      const Notifications = require('expo-notifications');

      // Handle notification that launched the app (cold start / lock screen)
      Notifications.getLastNotificationResponseAsync().then((response: any) => {
        if (response) {
          handleNotificationNavigation(response.notification.request.content.data);
        }
      });

      // Handle notification taps while app is running (background / foreground)
      subscription = Notifications.addNotificationResponseReceivedListener(
        (response: any) => {
          handleNotificationNavigation(response.notification.request.content.data);
        },
      );
    } catch {}
    return () => subscription?.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
          <StatusBar style="light" />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
