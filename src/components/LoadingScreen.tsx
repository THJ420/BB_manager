import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius } from '../theme/colors';

const TRACK_WIDTH = 168;
const SLIDER_WIDTH = 64;

export function LoadingScreen({ label = 'Loading terminal…' }: { label?: string }) {
  const entrance = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const entranceAnim = Animated.timing(entrance, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    const sweepAnim = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    const glowAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    entranceAnim.start();
    sweepAnim.start();
    glowAnim.start();
    return () => {
      entranceAnim.stop();
      sweepAnim.stop();
      glowAnim.stop();
    };
  }, [entrance, sweep, glow]);

  const markScale = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0.86, 1],
  });
  const nameOpacity = entrance.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 1],
  });
  const taglineOpacity = entrance.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0, 0, 1],
  });
  const sweepX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-SLIDER_WIDTH, TRACK_WIDTH],
  });
  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.6],
  });

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
        <Animated.Image
          source={require('../../assets/splash-icon.png')}
          style={[styles.mark, { opacity: entrance, transform: [{ scale: markScale }] }]}
          resizeMode="contain"
          accessibilityLabel="BB Manager"
        />
      </View>
      <Animated.Text style={[styles.name, { opacity: nameOpacity }]}>
        BB MANAGER
      </Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Restaurant Operations Terminal
      </Animated.Text>
      <View style={styles.track}>
        <Animated.View
          style={[styles.slider, { transform: [{ translateX: sweepX }] }]}
        />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 24,
    gap: 10,
  },
  brand: {
    width: 168,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  glow: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryMuted,
  },
  mark: {
    width: 152,
    height: 152,
  },
  name: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    color: Colors.textPrimary,
  },
  tagline: {
    fontSize: 12,
    letterSpacing: 0.4,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  track: {
    width: TRACK_WIDTH,
    height: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHighlight,
    overflow: 'hidden',
  },
  slider: {
    width: SLIDER_WIDTH,
    height: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  label: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.textMuted,
  },
});