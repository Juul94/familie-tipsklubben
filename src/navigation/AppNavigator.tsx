import React from 'react';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';

import HomeScreen from '../screens/HomeScreen';
import RoundsScreen from '../screens/RoundsScreen';
import TipsScreen from '../screens/TipsScreen';
import StandingsScreen from '../screens/StandingsScreen';
import RulesScreen from '../screens/RulesScreen';
import Top6Screen from '../screens/Top6Screen';
import AdminScreen from '../screens/AdminScreen';
import StatsScreen from '../screens/StatsScreen';
import ChatScreen from '../screens/ChatScreen';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

function RoundsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
      }}
    >
      <Stack.Screen name="RoundsList" component={RoundsScreen} options={{ title: 'Runder', headerShown: false }} />
      <Stack.Screen name="Tips" component={TipsScreen} options={{ title: 'Tips', headerShown: false }} />
    </Stack.Navigator>
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, signOut } = useAuth();
  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: Colors.primary }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}
    >
      <View>
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerLogo}>⚽</Text>
          <Text style={styles.drawerTitle}>Familietipsklubben</Text>
          {user && <Text style={styles.drawerUser}>{user.name}</Text>}
        </View>
        <DrawerItemList {...props} />
      </View>
      <View>
        <Text style={styles.versionText}>v{Constants.expoConfig?.version}</Text>
        <TouchableOpacity
          style={styles.privacyLink}
          onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? '')}
        >
          <Text style={styles.privacyText}>Privatlivspolitik</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Log ud</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

export default function AppNavigator() {
  const { user } = useAuth();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '600' },
        drawerActiveTintColor: Colors.secondary,
        drawerInactiveTintColor: 'rgba(255,255,255,0.7)',
        drawerActiveBackgroundColor: 'rgba(255,255,255,0.1)',
        drawerStyle: {
          backgroundColor: Colors.primary,
          width: 280,
        },
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: '500',
        },
        headerShown: false,
      }}
    >
      <Drawer.Screen
        name="Hjem"
        component={HomeScreen}
        options={{ drawerIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }}
      />
      <Drawer.Screen
        name="Runder"
        component={RoundsStack}
        options={{ drawerIcon: ({ color, size }) => <Ionicons name="football-outline" size={size} color={color} /> }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.navigate('Runder', { screen: 'RoundsList' });
          },
        })}
      />
      <Drawer.Screen
        name="Stilling"
        component={StandingsScreen}
        options={{ drawerIcon: ({ color, size }) => <Ionicons name="trophy-outline" size={size} color={color} /> }}
      />
      <Drawer.Screen
        name="Top 6"
        component={Top6Screen}
        options={{ drawerIcon: ({ color, size }) => <Ionicons name="star-outline" size={size} color={color} /> }}
      />
      <Drawer.Screen
        name="Regler"
        component={RulesScreen}
        options={{ drawerIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} /> }}
      />
      <Drawer.Screen
        name="Statistikker"
        component={StatsScreen}
        options={{ drawerIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} /> }}
      />
      <Drawer.Screen
        name="Chat"
        component={ChatScreen}
        options={{ drawerIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} /> }}
      />
      {user?.isAdmin && (
        <Drawer.Screen
          name="Admin"
          component={AdminScreen}
          options={{ drawerIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} /> }}
        />
      )}
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    marginBottom: 8,
  },
  drawerLogo: {
    fontSize: 40,
    marginBottom: 8,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  drawerUser: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  logoutText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  privacyLink: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  privacyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  versionText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
});
