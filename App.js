import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/lib/queryClient';
import { AuthProvider } from './src/context/AuthContext';
import { AppSettingsProvider } from './src/context/AppSettingsContext';
import { SidebarProvider } from './src/context/SidebarContext';
import { SystemFilterProvider } from './src/context/SystemFilterContext';
import { ConnectionStatusProvider } from './src/context/ConnectionStatusContext';
import { NotificationsProvider } from './src/context/NotificationsProvider';
import { GlobalErrorBoundary } from './src/components/GlobalErrorBoundary';
import { FeedbackProvider } from './src/components/feedback';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <FeedbackProvider>
            <AppSettingsProvider>
              <AuthProvider>
                <NotificationsProvider>
                  <ConnectionStatusProvider>
                    <SidebarProvider>
                      <SystemFilterProvider>
                        <StatusBar style="light" backgroundColor="#0A0A0A" />
                        <AppNavigator />
                      </SystemFilterProvider>
                    </SidebarProvider>
                  </ConnectionStatusProvider>
                </NotificationsProvider>
              </AuthProvider>
            </AppSettingsProvider>
          </FeedbackProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
