import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '../theme/tokens';
import { useAuth } from '../contexts/AuthContext';
import KPIDashboardScreen from './KPIDashboardScreen';
import ProfileSettingsScreen from './ProfileSettingsScreen';

export default function HomeScreen() {
  const { signOut } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerGreeting}>
          <Text style={styles.headerHello}>Hi, Jonathan</Text>
          <Text style={styles.headerWelcome}>Welcome back</Text>
        </View>
        <TouchableOpacity
          onPress={() => setMenuOpen((v) => !v)}
          style={styles.avatarBtn}
          accessibilityRole="button"
          accessibilityLabel="Open account menu"
        >
          <Text style={styles.avatarText}>JS</Text>
        </TouchableOpacity>
      </View>

      {menuOpen ? (
        <>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowProfile(false);
                setMenuOpen(false);
              }}
            >
              <Text style={styles.menuText}>Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowProfile(true);
                setMenuOpen(false);
              }}
            >
              <Text style={styles.menuText}>Profile & Goals</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
              <Text style={styles.menuDangerText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      <View style={styles.body}>
        {showProfile ? (
          <ProfileSettingsScreen onBack={() => setShowProfile(false)} showHeader />
        ) : (
          <KPIDashboardScreen onOpenProfile={() => setShowProfile(true)} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8edf3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  headerGreeting: {
    flex: 1,
    paddingRight: 12,
  },
  headerHello: {
    fontSize: 22,
    color: '#2f3442',
    fontWeight: '700',
  },
  headerWelcome: {
    marginTop: 2,
    fontSize: 13,
    color: '#8a93a3',
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dfeafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#b8cbef',
    marginTop: -2,
  },
  avatarText: {
    fontSize: 13,
    color: '#254888',
    fontWeight: '700',
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 19,
  },
  menuCard: {
    position: 'absolute',
    top: 64,
    right: space.xl,
    width: 180,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e9f2',
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f8',
  },
  menuText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  menuDangerText: {
    fontSize: 15,
    color: '#c13a3a',
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
});
