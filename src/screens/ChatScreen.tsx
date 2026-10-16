import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  InputAccessoryView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToChatMessages, sendChatMessage, ChatMessage } from '../services/firestoreService';
import { sendChatNotification } from '../services/notificationService';
import { Colors } from '../constants/Colors';
import DrawerToggle from '../components/DrawerToggle';

function formatTime(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  return date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'I dag';
  if (date.toDateString() === yesterday.toDateString()) return 'I går';
  return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
}

function isSameDay(a: Timestamp, b: Timestamp): boolean {
  return a.toDate().toDateString() === b.toDate().toDateString();
}

export default function ChatScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsub = subscribeToChatMessages(setMessages);
    return unsub;
  }, []);

  const handleSend = async () => {
    if (!input.trim() || !user || sending) return;
    const msg = input.trim();
    setInput('');
    setSending(true);
    try {
      await sendChatMessage(user.id, user.name, msg);
      sendChatNotification(user.id, user.name, msg);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isOwn = item.userId === user?.id;
    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
    const showDateDivider = !nextMessage || !isSameDay(item.timestamp, nextMessage.timestamp);

    return (
      <View>
        {showDateDivider && (
          <View style={styles.dateDivider}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
            <View style={styles.dateLine} />
          </View>
        )}
        <View style={[styles.messageBubbleRow, isOwn ? styles.ownRow : styles.otherRow]}>
          <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
            {!isOwn && <Text style={styles.userName}>{item.userName}</Text>}
            <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>{item.message}</Text>
            <Text style={[styles.timeText, isOwn && styles.ownTimeText]}>{formatTime(item.timestamp)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>💬 Chat</Text>
          <DrawerToggle />
        </View>
      </View>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={styles.listContent}
      />
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Skriv en besked..."
          placeholderTextColor="#999"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Ionicons name="send" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 54,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageBubbleRow: {
    marginVertical: 3,
    flexDirection: 'row',
  },
  ownRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  ownBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    color: Colors.primary,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#ffffff',
  },
  timeText: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownTimeText: {
    color: 'rgba(255,255,255,0.6)',
  },
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d0d0d0',
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    marginHorizontal: 12,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: Colors.primary,
  },
  sendButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
