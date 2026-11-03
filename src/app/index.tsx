import { Redirect } from 'expo-router';
import React from 'react';
import { LoadingScreen } from '../components/LoadingScreen';
import { useApp } from '../state/AppProvider';

export default function IndexRoute() {
  const { state } = useApp();

  if (!state.hydrated) {
    return <LoadingScreen label="Opening BB Manager…" />;
  }

  return <Redirect href={state.session ? '/(app)' : '/login'} />;
}
