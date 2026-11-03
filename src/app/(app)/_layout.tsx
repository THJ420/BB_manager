import { Redirect, Slot } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomNav } from '../../components/BottomNav';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useApp } from '../../state/AppProvider';
import { Colors } from '../../theme/colors';

export default function AppGroupLayout() {
  const { state } = useApp();

  if (!state.hydrated) {
    return <LoadingScreen />;
  }

  if (!state.session) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Slot />
      </View>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
});
