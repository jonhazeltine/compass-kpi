import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  currentTier: string;
  requiredPlan: string;
  onClose: () => void;
  onUpgrade: () => void;
};

export default function PaywallModal({
  visible,
  title,
  message,
  currentTier,
  requiredPlan,
  onClose,
  onUpgrade,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>Current: {currentTier.toUpperCase()}</Text>
          <Text style={styles.meta}>Required: {requiredPlan.toUpperCase()}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.primary} onPress={onUpgrade} activeOpacity={0.9}>
            <Text style={styles.primaryText}>Upgrade Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={onClose} activeOpacity={0.9}>
            <Text style={styles.secondaryText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'flex-end',
    padding: 18,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe6fb',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  meta: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#3b82f6',
  },
  message: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    color: '#475569',
  },
  primary: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#2f5fd0',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  secondary: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c9d6ef',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4b5f85',
  },
});
