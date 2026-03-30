import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BottomTab } from '../../screens/kpi-dashboard/types';
import {
  bottomTabIconSvgByKey,
  bottomTabIconStyleByKey,
  bottomTabAccessibilityLabel,
  bottomTabDisplayLabel,
} from '../../screens/kpi-dashboard/constants';
import { DEV_TOOLS_ENABLED } from '../../lib/supabase';

export interface BottomTabBarProps {
  activeTab: BottomTab;
  bottomTabOrder: BottomTab[];
  bottomNavPadBottom: number;
  bottomNavLift: number;
  bottomNavAnimation: {
    animatedStyle: object;
    isNavHidden: boolean;
  };
  modeLanePulseAnim: Animated.Value;
  bottomTabTheme: {
    activeFg: string;
    inactiveFg: string;
    activeBg: string;
  };
  unreadMessagesBadgeLabel: string | null;
  onBottomTabPress: (tab: BottomTab) => void;
  onLayout: (height: number) => void;
  onDevToolsOpen: () => void;
}

export default function BottomTabBar({
  activeTab,
  bottomTabOrder,
  bottomNavPadBottom,
  bottomNavLift,
  bottomNavAnimation,
  modeLanePulseAnim,
  bottomTabTheme,
  unreadMessagesBadgeLabel,
  onBottomTabPress,
  onLayout,
  onDevToolsOpen,
}: BottomTabBarProps) {
  return (
    <Animated.View
      style={[
        styles.bottomNav,
        { paddingBottom: bottomNavPadBottom, bottom: bottomNavLift },
        bottomNavAnimation.animatedStyle,
      ]}
      pointerEvents={bottomNavAnimation.isNavHidden ? 'none' : 'auto'}
      onLayout={(e) => onLayout(e.nativeEvent.layout.height)}
    >
      {bottomTabOrder.map((tab) => {
        const TabIcon = bottomTabIconSvgByKey[tab];
        const isActive = activeTab === tab;
        const isLog = tab === 'home';
        const iconColor = isLog ? '#ffffff' : isActive ? bottomTabTheme.activeFg : bottomTabTheme.inactiveFg;
        const labelColor = isLog ? '#28a84d' : isActive ? '#1f5fe2' : '#8d95a5';
        return (
          <TouchableOpacity
            key={tab}
            accessibilityRole="button"
            accessibilityLabel={bottomTabAccessibilityLabel[tab]}
            accessibilityState={{ selected: isActive }}
            style={[styles.bottomItem, isLog && styles.bottomItemLogCta]}
            activeOpacity={isLog ? 0.75 : 0.6}
            onPress={() => onBottomTabPress(tab)}
            delayLongPress={3000}
            onLongPress={() => {
              if (!DEV_TOOLS_ENABLED || !isLog) return;
              onDevToolsOpen();
            }}
          >
            <Animated.View
              style={[
                styles.bottomItemInner,
                isActive && !isLog
                  ? {
                      transform: [
                        { scale: modeLanePulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
                      ],
                    }
                  : undefined,
              ]}
            >
              {isLog ? (
                <View style={styles.bottomLogOuter}>
                  <View style={styles.bottomLogGlowRing} />
                  <View style={styles.bottomLogBtn}>
                    <View style={[styles.bottomLogSparkle, styles.bottomLogSparkleOne]} />
                    <View style={[styles.bottomLogSparkle, styles.bottomLogSparkleTwo]} />
                    <View style={[styles.bottomLogSparkle, styles.bottomLogSparkleThree]} />
                    <TabIcon width={36} height={36} color="#ffffff" style={styles.bottomIconSvgLog} />
                  </View>
                  <Text style={styles.bottomLogLabel}>LOG</Text>
                </View>
              ) : (
                <>
                  <View style={[styles.bottomIconSvgWrap, isActive && { backgroundColor: bottomTabTheme.activeBg }]}>
                    <TabIcon
                      width={40}
                      height={40}
                      color={iconColor}
                      style={[styles.bottomIconSvg, bottomTabIconStyleByKey[tab]]}
                    />
                  </View>
                  <Text style={[styles.bottomTabLabel, { color: labelColor }, isActive && styles.bottomTabLabelActive]}>
                    {bottomTabDisplayLabel[tab]}
                  </Text>
                </>
              )}
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 10,
    zIndex: 90,
    elevation: 90,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    overflow: 'visible',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 6,
    shadowColor: '#1a2138',
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -3 },
  },
  bottomItem: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    minHeight: 44,
    paddingBottom: 0,
    zIndex: 2,
  },
  bottomItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomItemLogCta: {
    minHeight: 44,
    zIndex: 10,
  },
  bottomIconSvgWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomIconSvg: {},
  bottomTabLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    letterSpacing: 0.15,
    color: '#8d95a5',
    marginTop: 0,
  },
  bottomTabLabelActive: {
    fontWeight: '800',
  },
  bottomLogOuter: {
    alignItems: 'center',
    marginTop: -30,
  },
  bottomLogGlowRing: {
    position: 'absolute',
    top: -4,
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(40, 168, 77, 0.10)',
    borderWidth: 2,
    borderColor: 'rgba(40, 168, 77, 0.15)',
  },
  bottomLogBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#28a84d',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#1e9441',
    shadowOpacity: 0.38,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 14,
    zIndex: 10,
  },
  bottomIconSvgLog: {},
  bottomLogSparkle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(231, 255, 230, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  bottomLogSparkleOne: {
    top: 11,
    right: 10,
  },
  bottomLogSparkleTwo: {
    top: 17,
    left: 10,
    width: 5,
    height: 5,
  },
  bottomLogSparkleThree: {
    bottom: 14,
    right: 14,
    width: 4,
    height: 4,
    backgroundColor: 'rgba(200, 255, 200, 0.7)',
  },
  bottomLogLabel: {
    color: '#28a84d',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  bottomNavUnreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 999,
    paddingHorizontal: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
    elevation: 25,
  },
  bottomNavUnreadBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
});
