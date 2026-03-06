import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { resolveKpiIcon, type KpiIconMetadata } from '../../lib/kpiIcons';

type Props = {
  kpi: KpiIconMetadata;
  size?: number;
  backgroundColor?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
  emojiStyle?: StyleProp<TextStyle>;
};

export default function KpiIcon({
  kpi,
  size = 40,
  backgroundColor = 'transparent',
  color = '#243041',
  style,
  emojiStyle,
}: Props) {
  const resolution = resolveKpiIcon(kpi);
  const wrapperStyle = [
    styles.wrapper,
    {
      width: size,
      height: size,
      borderRadius: Math.max(10, Math.round(size * 0.32)),
      backgroundColor,
    },
    style,
  ];

  if (resolution.kind === 'brand_asset') {
    return (
      <View style={wrapperStyle}>
        <View style={[styles.imageClip, { borderRadius: Math.max(10, Math.round(size * 0.3)) }]}>
          <Image source={resolution.imageSource} style={styles.image} resizeMode="cover" />
        </View>
      </View>
    );
  }

  if (resolution.kind === 'vector_icon') {
    return (
      <View style={wrapperStyle}>
        <MaterialCommunityIcons name={resolution.iconName as never} size={Math.max(16, size * 0.62)} color={color} />
      </View>
    );
  }

  return (
    <View style={wrapperStyle}>
      <Text style={[styles.emoji, { color, fontSize: Math.max(16, size * 0.54) }, emojiStyle]}>
        {resolution.emoji}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageClip: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
