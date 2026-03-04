import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AvatarMenuProps = {
  visible: boolean;
  onClose: () => void;
  onSelectProfile: () => void;
  onSelectGoals: () => void;
  onSelectSettings: () => void;
  onSelectInvite: () => void;
  onSignOut: () => void;
};

type MenuAction = {
  label: string;
  onPress: () => void;
};

export default function AvatarMenu({
  visible,
  onClose,
  onSelectProfile,
  onSelectGoals,
  onSelectSettings,
  onSelectInvite,
  onSignOut,
}: AvatarMenuProps) {
  const actions: MenuAction[] = [
    { label: 'Profile', onPress: onSelectProfile },
    { label: 'Goals', onPress: onSelectGoals },
    { label: 'Settings', onPress: onSelectSettings },
    { label: 'Enter Invite Code', onPress: onSelectInvite },
    { label: 'Sign out', onPress: onSignOut },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.anchorWrap}>
          <Pressable style={styles.menuCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.menuTitle}>Account</Text>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={styles.row}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
              >
                <Text style={styles.rowLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.2)',
  },
  anchorWrap: {
    alignItems: 'flex-end',
    paddingTop: 72,
    paddingHorizontal: 20,
  },
  menuCard: {
    width: 232,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d7deea',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
    paddingVertical: 8,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  row: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  rowLabel: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
  },
});
