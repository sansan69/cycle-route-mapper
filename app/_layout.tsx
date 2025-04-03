import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    async function requestStorage() {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Required", "We need storage permission to save routes.");
      }
    }
    requestStorage();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
