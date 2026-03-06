import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getKpiTypeIconTreatment, resolveKpiIcon, type KpiIconMetadata } from '../../lib/kpiIcons';

type Props = {
  kpi: KpiIconMetadata;
  size?: number;
  backgroundColor?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export default function KpiIcon({
  kpi,
  size = 40,
  backgroundColor,
  color,
  style,
}: Props) {
  const resolution = resolveKpiIcon(kpi);
  const treatment = getKpiTypeIconTreatment(kpi.type);
  const resolvedBackgroundColor = backgroundColor ?? treatment.background;
  const resolvedColor = color ?? treatment.foreground;
  const wrapperStyle = [
    styles.wrapper,
    {
      width: size,
      height: size,
      borderRadius: Math.max(10, Math.round(size * 0.32)),
      backgroundColor: resolvedBackgroundColor,
    },
    style,
  ];

  if (resolution.kind === 'brand_asset') {
    return (
      <View style={wrapperStyle}>
        <View style={[styles.imageClip, { width: size * 0.72, height: size * 0.72, borderRadius: Math.max(10, Math.round(size * 0.24)) }]}>
          <Image source={resolution.imageSource} style={styles.image} resizeMode="contain" />
        </View>
      </View>
    );
  }

  if (resolution.kind === 'vector_icon') {
    return (
      <View style={wrapperStyle}>
        <MaterialCommunityIcons
          name={resolution.iconName as never}
          size={Math.max(16, size * 0.58)}
          color={resolvedColor}
        />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageClip: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
