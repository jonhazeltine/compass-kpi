import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Floating overlay with Unity VP Tree debug controls.
 * Rendered on top of everything when toggled from HomeScreen.
 *
 * Message format: "action:value"
 *   - "setvp:500"   -> sets VP total to 500
 *   - "pulse:10"    -> triggers +10 VP with orb animation
 *   - "nexttier"    -> jumps to next tier threshold
 *   - "reset"       -> resets to 0
 */

interface UnityControlsOverlayProps {
  status: string;
  onSendMessage: (message: string) => void;
  onClose: () => void;
}

export default function UnityControlsOverlay({
  status,
  onSendMessage,
  onClose,
}: UnityControlsOverlayProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={[styles.panel, { paddingBottom: insets.bottom + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Unity Controls</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* Status */}
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>{status}</Text>
        </View>

        {/* Control buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.buttonPulse]}
            onPress={() => onSendMessage('pulse:10')}
          >
            <Text style={styles.buttonText}>+10 VP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonTier]}
            onPress={() => onSendMessage('nexttier')}
          >
            <Text style={styles.buttonText}>Next Tier</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          {[0, 25, 100, 250, 500, 1000].map((vp) => (
            <TouchableOpacity
              key={vp}
              style={[styles.button, styles.buttonSmall]}
              onPress={() => onSendMessage(`setvp:${vp}`)}
            >
              <Text style={styles.buttonTextSmall}>{vp}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonReset]}
          onPress={() => onSendMessage('reset')}
        >
          <Text style={styles.buttonText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 998,
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  closeText: {
    color: '#4fc3f7',
    fontSize: 15,
    fontWeight: '600',
  },
  statusBar: {
    backgroundColor: '#2a2a3e',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  statusText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
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
