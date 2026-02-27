import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '../theme/tokens';
import KPIDashboardScreen from './KPIDashboardScreen';
import ProfileSettingsScreen from './ProfileSettingsScreen';

export default function HomeScreen() {
  const [showProfile, setShowProfile] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
  body: {
    flex: 1,
  },
});
