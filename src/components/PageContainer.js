import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useBreakpoint } from '../hooks/useBreakpoint';

export default function PageContainer({
  children,
  style,
  contentContainerStyle,
  scrollable = true,
  refreshControl = null,
}) {
  const { isSm, isMd, isLg } = useBreakpoint();

  const horizontalPadding = isSm ? 16 : isMd ? 20 : isLg ? 24 : 32;

  if (!scrollable) {
    return (
      <View style={[styles.container, { paddingHorizontal: horizontalPadding }, style]}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingHorizontal: horizontalPadding },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingVertical: 20,
    width: '100%',
  },
  container: {
    flex: 1,
    width: '100%',
    paddingVertical: 20,
  },
});
