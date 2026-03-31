import React, { useRef, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UnityView from '@azesmway/react-native-unity';

/**
 * Test screen for Unity VP Tree integration.
 * Renders the Unity tree view and provides buttons to control it
 * via message passing (React → Unity).
 *
 * Message format: "action:value"
 *   - "setvp:500"   → sets VP total to 500
 *   - "pulse:10"    → triggers +10 VP with orb animation
 *   - "nexttier"    → jumps to next tier threshold
 *   - "reset"       → resets to 0
 */

interface UnityTreeTestScreenProps {
  onBack?: () => void;
}

export default function UnityTreeTestScreen({ onBack }: UnityTreeTestScreenProps) {
  const unityRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState('Initializing...');

  const sendMessage = useCallback((message: string) => {
    unityRef.current?.postMessage('VPTree', 'ReceiveMessage', message);
  }, []);

  const handleUnityMessage = useCallback((result: string) => {
    console.log('[Unity → React]', result);
    setStatus(`Unity: ${result}`);
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Unity view only works on device</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerTitle}>Unity VP Tree</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      {/* Unity View — fills most of the screen */}
      <View style={styles.unityContainer}>
        <UnityView
          ref={unityRef}
          style={styles.unity}
          onUnityMessage={(e: any) => {
            handleUnityMessage(e.nativeEvent.message);
            setStatus('Unity connected');
          }}
        />
      </View>

      {/* Control buttons at the bottom */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.buttonPulse]}
            onPress={() => sendMessage('pulse:10')}
          >
            <Text style={styles.buttonText}>+10 VP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonTier]}
            onPress={() => sendMessage('nexttier')}
          >
            <Text style={styles.buttonText}>Next Tier</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          {[0, 25, 100, 250, 500, 1000].map((vp) => (
            <TouchableOpacity
              key={vp}
              style={[styles.button, styles.buttonSmall]}
              onPress={() => sendMessage(`setvp:${vp}`)}
            >
              <Text style={styles.buttonTextSmall}>{vp}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonReset]}
          onPress={() => sendMessage('reset')}
        >
          <Text style={styles.buttonText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#1a1a2e',
  },
  backBtn: {
    width: 60,
  },
  backText: {
    color: '#4fc3f7',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  statusBar: {
    backgroundColor: '#2a2a3e',
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  statusText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  unityContainer: {
    flex: 1,
  },
  unity: {
    flex: 1,
  },
  controls: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPulse: {
    backgroundColor: '#2ecc71',
    flex: 1,
  },
  buttonTier: {
    backgroundColor: '#9b59b6',
    flex: 1,
  },
  buttonSmall: {
    backgroundColor: '#34495e',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  buttonReset: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSmall: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});
