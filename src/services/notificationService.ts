import { Platform, Alert } from 'react-native';
import { savePushToken, getAllPushTokens, getPushTokensExcept } from './firestoreService';

// Lazy-load expo-notifications to avoid crash in Expo Go (SDK 53+)
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

} catch {
  // expo-notifications not available (Expo Go)
}

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  try {
    if (!Notifications) {
      Alert.alert('Push fejl', 'expo-notifications modul ikke tilgængeligt.');
      return null;
    }

    const Device = require('expo-device') as typeof import('expo-device');
    const Constants = (require('expo-constants') as typeof import('expo-constants')).default;

    if (!Device.isDevice) {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Standard',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#cadd65',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Push fejl', 'Notifikationstilladelse ikke givet. Gå til telefonens indstillinger og tillad notifikationer for Familietipsklubben.');
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      Alert.alert('Push fejl', 'Intet EAS projectId fundet. Kontakt admin.');
      return null;
    }
    // Retry up to 3 times – Expo's token endpoint sometimes returns 503
    let lastError: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;
        await savePushToken(userId, token);
        return token;
      } catch (e: any) {
        lastError = e;
        if (attempt < 2) {
          // Wait before retrying: 2s, 4s
          await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        }
      }
    }
    // All retries failed – log silently, don't alarm users with transient errors
    console.warn('Push token registration failed after 3 attempts:', lastError?.message);
    return null;
  } catch (e: any) {
    console.warn('Push registration error:', e?.message);
    return null;
  }
}

/**
 * Send a push notification to all registered users via Expo Push API.
 */
export async function sendPushNotificationToAll(
  title: string,
  body: string,
): Promise<{ success: number; failed: number; names: string[] }> {
  const { tokens, names } = await getAllPushTokens();
  if (tokens.length === 0) {
    return { success: 0, failed: 0, names: [] };
  }

  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default' as const,
    title,
    body,
    data: { type: 'admin_notification' },
  }));

  // Expo Push API supports batches of up to 100
  let success = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });
      const result = await response.json();
      if (result.data) {
        result.data.forEach((r: any) => {
          if (r.status === 'ok') success++;
          else failed++;
        });
      }
    } catch (error) {
      console.error('Error sending push notifications:', error);
      failed += batch.length;
    }
  }

  return { success, failed, names };
}

/**
 * Schedule a reminder notification for the day before the deadline at 18:00.
 * Uses a consistent identifier so it can be cancelled when the user submits.
 */
export async function scheduleRoundReminder(roundNumber: number, deadline: Date): Promise<void> {
  try {
    if (!Notifications) return;

    const reminderDate = new Date(deadline);
    reminderDate.setDate(reminderDate.getDate() - 1);
    reminderDate.setHours(18, 0, 0, 0);

    if (reminderDate <= new Date()) return;

    const identifier = `round_reminder_${roundNumber}`;
    await cancelRoundReminder(roundNumber);

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: '⚽ Husk at tippe!',
        body: `Du har ikke tippet for runde ${roundNumber} endnu. Deadline er i morgen!`,
        sound: 'default',
        data: { type: 'tip_reminder', roundNumber },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });
  } catch {
    // Silently fail in Expo Go
  }
}

/**
 * Cancel the reminder for a specific round (e.g., after submitting a tip).
 */
export async function cancelRoundReminder(roundNumber: number): Promise<void> {
  try {
    if (!Notifications) return;
    await Notifications.cancelScheduledNotificationAsync(`round_reminder_${roundNumber}`);
  } catch {
    // Silently fail
  }
}

/**
 * Check all open rounds and schedule reminders for ones the user hasn't tipped.
 * Call this on app startup / login.
 */
export async function scheduleRemindersForUntippedRounds(userId: string): Promise<void> {
  try {
    const { getAllRounds, getTipsForRound } = await import('./firestoreService');
    const rounds = await getAllRounds();
    const openRounds = rounds.filter((r) => r.status === 'open');

    for (const round of openRounds) {
      const deadline = round.deadline instanceof Date
        ? round.deadline
        : (round.deadline as any)?.toDate
          ? (round.deadline as any).toDate()
          : new Date(round.deadline as any);

      const tips = await getTipsForRound(round.roundNumber);
      const hasTipped = tips.some((t) => t.userId === userId);

      if (hasTipped) {
        await cancelRoundReminder(round.roundNumber);
      } else {
        await scheduleRoundReminder(round.roundNumber, deadline);
      }
    }
  } catch {
    // Silently fail
  }
}

/**
 * Send push notification to all users except the sender when a chat message is sent.
 */
export async function sendChatNotification(
  senderUserId: string,
  senderName: string,
  message: string,
): Promise<void> {
  try {
    const tokens = await getPushTokensExcept(senderUserId);
    if (tokens.length === 0) return;

    const truncated = message.length > 80 ? message.slice(0, 80) + '…' : message;
    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default' as const,
      title: `Ny besked fra ${senderName}`,
      body: truncated,
      data: { type: 'chat_message' },
    }));

    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });
    }
  } catch {
    // Silently fail - don't block chat
  }
}
