import React, { useState } from 'react';
import { View, useWindowDimensions, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';

// Auth screens
import AdminLoginScreen from '../screens/auth/AdminLoginScreen';
import WorkerLoginScreen from '../screens/auth/WorkerLoginScreen';
import WorkerSignUpScreen from '../screens/auth/WorkerSignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ProfileScreen from '../screens/auth/ProfileScreen';

// Worker screens
import ChooseWorkScreen from '../screens/worker/ChooseWorkScreen';
import TodayScreen from '../screens/worker/TodayScreen';

// Admin screens
import ScheduleCalendarScreen from '../screens/admin/ScheduleCalendarScreen';
import SetScheduleScreen from '../screens/admin/SetScheduleScreen';
import ManageEquipmentScreen from '../screens/admin/ManageEquipmentScreen';
import PerformanceScreen from '../screens/admin/PerformanceScreen';
import UsersScreen from '../screens/admin/UsersScreen';

import WebSidebar from '../components/WebSidebar';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { colors, layout } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- ADMIN MOBILE BOTTOM TABS ---
function AdminTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'calendar';
          if (route.name === 'CalendarTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'SetScheduleTab') {
            iconName = focused ? 'create' : 'create-outline';
          } else if (route.name === 'EquipmentTab') {
            iconName = focused ? 'hardware-chip' : 'hardware-chip-outline';
          } else if (route.name === 'PerformanceTab') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'UsersTab') {
            iconName = focused ? 'people' : 'people-outline';
          }
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="CalendarTab"
        component={ScheduleCalendarScreen}
        options={{ tabBarLabel: 'Calendar' }}
      />
      <Tab.Screen
        name="SetScheduleTab"
        component={SetScheduleScreen}
        options={{ tabBarLabel: 'Set Schedule' }}
      />
      <Tab.Screen
        name="EquipmentTab"
        component={ManageEquipmentScreen}
        options={{ tabBarLabel: 'Equipment' }}
      />
      <Tab.Screen
        name="PerformanceTab"
        component={PerformanceScreen}
        options={{ tabBarLabel: 'Performance' }}
      />
      <Tab.Screen
        name="UsersTab"
        component={UsersScreen}
        options={{ tabBarLabel: 'Users' }}
      />
    </Tab.Navigator>
  );
}

// --- WORKER MOBILE BOTTOM TABS ---
function WorkerTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'today';
          if (route.name === 'WorkerTodayTab') {
            iconName = focused ? 'today' : 'today-outline';
          } else if (route.name === 'ChooseWorkTab') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="WorkerTodayTab"
        component={TodayScreen}
        options={{ tabBarLabel: 'Today' }}
      />
      <Tab.Screen
        name="ChooseWorkTab"
        component={ChooseWorkScreen}
        options={{ tabBarLabel: 'My System' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// --- RESPONSIVE WEB CONTAINER (SIDEBAR ON DESKTOP) ---
function ResponsiveAdminLayout({ navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [activeScreen, setActiveScreen] = useState('AdminCalendar');

  if (!isDesktop) {
    return <AdminTabNavigator />;
  }

  const renderActiveScreen = () => {
    switch (activeScreen) {
      case 'AdminCalendar':
        return <ScheduleCalendarScreen navigation={navigation} />;
      case 'SetSchedule':
        return <SetScheduleScreen navigation={navigation} />;
      case 'ManageEquipment':
        return <ManageEquipmentScreen navigation={navigation} />;
      case 'Performance':
        return <PerformanceScreen navigation={navigation} />;
      case 'Users':
        return <UsersScreen navigation={navigation} />;
      case 'WorkerToday':
        return <TodayScreen navigation={navigation} />;
      case 'ChooseWork':
        return <ChooseWorkScreen navigation={navigation} />;
      default:
        return <ScheduleCalendarScreen navigation={navigation} />;
    }
  };

  return (
    <View style={styles.webContainer}>
      <WebSidebar
        activeRoute={activeScreen}
        onNavigate={(routeKey) => setActiveScreen(routeKey)}
      />
      <View style={styles.webMainContent}>{renderActiveScreen()}</View>
    </View>
  );
}

function ResponsiveWorkerLayout({ navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [activeScreen, setActiveScreen] = useState('WorkerToday');

  if (!isDesktop) {
    return <WorkerTabNavigator />;
  }

  const renderActiveScreen = () => {
    switch (activeScreen) {
      case 'WorkerToday':
        return <TodayScreen navigation={navigation} />;
      case 'ChooseWork':
        return <ChooseWorkScreen navigation={navigation} />;
      default:
        return <TodayScreen navigation={navigation} />;
    }
  };

  return (
    <View style={styles.webContainer}>
      <WebSidebar
        activeRoute={activeScreen}
        onNavigate={(routeKey) => setActiveScreen(routeKey)}
      />
      <View style={styles.webMainContent}>{renderActiveScreen()}</View>
    </View>
  );
}

// --- MAIN ROOT STACK ---
export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <LoadingSkeleton message="Initializing maintenance hub..." />
      </View>
    );
  }

  // Unauthenticated: platform-specific auth
  if (!user) {
    if (Platform.OS === 'web') {
      // Web always shows the Admin login (full-screen, no stack needed)
      return (
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );
    } else {
      // Mobile shows the Worker auth stack
      return (
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="WorkerLogin" component={WorkerLoginScreen} />
            <Stack.Screen name="WorkerSignUp" component={WorkerSignUpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );
    }
  }

  // Authenticated
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user.role === 'admin' ? (
          <>
            <Stack.Screen name="AdminRoot" component={ResponsiveAdminLayout} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="WorkerToday" component={TodayScreen} />
            <Stack.Screen name="ChooseWork" component={ChooseWorkScreen} />
            <Stack.Screen name="SetSchedule" component={SetScheduleScreen} />
            <Stack.Screen name="ManageEquipment" component={ManageEquipmentScreen} />
            <Stack.Screen name="Performance" component={PerformanceScreen} />
            <Stack.Screen name="Users" component={UsersScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="WorkerRoot" component={ResponsiveWorkerLayout} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="ChooseWork" component={ChooseWorkScreen} />
            <Stack.Screen name="WorkerToday" component={TodayScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  webContainer: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    width: '100%',
  },
  webMainContent: {
    flex: 1,
    height: '100%',
  },
});
