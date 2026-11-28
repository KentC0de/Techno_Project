import React, { useEffect, useState, useCallback } from 'react';
import { View, useWindowDimensions, StyleSheet, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { SidebarProvider, useSidebar } from '../context/SidebarContext';

// Auth screens
import AdminLoginScreen from '../screens/auth/AdminLoginScreen';
import WorkerLoginScreen from '../screens/auth/WorkerLoginScreen';
import WorkerSignUpScreen from '../screens/auth/WorkerSignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ProfileScreen from '../screens/auth/ProfileScreen';
import NotFoundScreen from '../screens/NotFoundScreen';
import AuthConfirmedScreen from '../screens/auth/AuthConfirmedScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import DisabledAccountScreen from '../screens/auth/DisabledAccountScreen';
import MaintenanceScreen from '../screens/auth/MaintenanceScreen';

// Worker screens
import ChooseWorkScreen from '../screens/worker/ChooseWorkScreen';
import TodayScreen from '../screens/worker/TodayScreen';
import WorkerReportScreen from '../screens/worker/WorkerReportScreen';

// Admin screens
import ScheduleCalendarScreen from '../screens/admin/ScheduleCalendarScreen';
import SetScheduleScreen from '../screens/admin/SetScheduleScreen';
import ManageEquipmentScreen from '../screens/admin/ManageEquipmentScreen';
import PerformanceScreen from '../screens/admin/PerformanceScreen';
import SiteMapScreen from '../screens/admin/SiteMapScreen';
import DashboardScreen from '../screens/admin/DashboardScreen';
import UsersScreen from '../screens/admin/UsersScreen';
import ActivityLogsScreen from '../screens/admin/ActivityLogsScreen';
import SettingsScreen from '../screens/admin/SettingsScreen';
import AssignWorkersScreen from '../screens/admin/AssignWorkersScreen';

import WebSidebar from '../components/WebSidebar';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { PageErrorBoundary } from '../components/GlobalErrorBoundary';
import { useWorkerGroupsRealtime } from '../hooks/useWorkerGroupsRealtime';
import { useTaskLogsRealtime } from '../hooks/useTaskLogsRealtime';
import { colors, layout } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const LAST_ROUTE_KEY = '@pm_last_admin_route';

// Deep linking configuration
const webLinking = {
  prefixes: ['/'],
  config: {
    screens: {
      AdminLogin: 'login',
      WorkerLogin: 'worker/login',
      WorkerSignUp: 'worker/signup',
      ForgotPassword: 'forgot-password',
      AuthConfirmed: 'auth/confirmed',
      ResetPassword: 'auth/reset-password',
      AdminRoot: {
        path: '',
        screens: {
          Dashboard: 'admin/dashboard',
          AdminCalendar: 'admin/calendar',
          ReportsList: 'admin/reports',
          ReportDetail: 'admin/reports/detail',
          SetSchedule: 'admin/set-schedule',
          AssignWorkers: 'admin/assign-workers',
          ManageEquipment: 'admin/equipment',
          Performance: 'admin/performance',
          SiteMap: 'admin/site-map',
          Users: 'admin/users',
          ActivityLogs: 'admin/activity',
          Settings: 'admin/settings',
          WorkerToday: 'admin/worker-view',
        },
      },
      WorkerRoot: {
        path: 'worker',
        screens: {
          WorkerTodayTab: 'today',
          ChooseWorkTab: 'my-system',
          WorkerReportTab: 'report',
          ProfileTab: 'profile',
        },
      },
      NotFound: '*',
    },
  },
};

const mobileLinking = {
  prefixes: ['solarpm://', 'exp://'],
  config: {
    screens: {
      WorkerLogin: 'worker/login',
      WorkerSignUp: 'worker/signup',
      ForgotPassword: 'forgot-password',
      AuthConfirmed: 'auth/confirmed',
      ResetPassword: 'auth/reset-password',
      WorkerRoot: {
        path: 'worker',
        screens: {
          WorkerTodayTab: 'today',
          ChooseWorkTab: 'my-system',
          WorkerReportTab: 'report',
          ProfileTab: 'profile',
        },
      },
    },
  },
};

// Dev-only startup check: ensure no conflicting/duplicate linking patterns
if (__DEV__) {
  const validateLinkingConfig = (screens, prefix = '', seenPatterns = new Map()) => {
    for (const [screenName, config] of Object.entries(screens || {})) {
      if (typeof config === 'string') {
        const fullPath = prefix ? `${prefix}/${config}` : config;
        if (seenPatterns.has(fullPath)) {
          const prevScreen = seenPatterns.get(fullPath);
          console.error(
            `[Linking Conflict Detected] The pattern "${fullPath}" resolves to both "${prevScreen}" and "${screenName}". Every route pattern must be unique!`
          );
        } else {
          seenPatterns.set(fullPath, screenName);
        }
      } else if (config && typeof config === 'object') {
        const currentPath = config.path !== undefined ? config.path : '';
        const nestedPrefix = prefix && currentPath ? `${prefix}/${currentPath}` : (currentPath || prefix);
        if (config.screens) {
          validateLinkingConfig(config.screens, nestedPrefix, seenPatterns);
        }
      }
    }
  };

  try {
    validateLinkingConfig(Platform.OS === 'web' ? webLinking.config.screens : mobileLinking.config.screens);
  } catch (e) {
    console.warn('[Linking validator warning]:', e);
  }
}

const linking = Platform.OS === 'web' ? webLinking : mobileLinking;

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
          if (route.name === 'AdminCalendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'SetSchedule') {
            iconName = focused ? 'create' : 'create-outline';
          } else if (route.name === 'ManageEquipment') {
            iconName = focused ? 'hardware-chip' : 'hardware-chip-outline';
          } else if (route.name === 'Performance') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'Users') {
            iconName = focused ? 'people' : 'people-outline';
          }
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="AdminCalendar"
        component={ScheduleCalendarScreen}
        options={{ tabBarLabel: 'Calendar' }}
      />
      <Tab.Screen
        name="SetSchedule"
        component={SetScheduleScreen}
        options={{ tabBarLabel: 'Set Schedule' }}
      />
      <Tab.Screen
        name="ManageEquipment"
        component={ManageEquipmentScreen}
        options={{ tabBarLabel: 'Equipment' }}
      />
      <Tab.Screen
        name="Performance"
        component={PerformanceScreen}
        options={{ tabBarLabel: 'Performance' }}
      />
      <Tab.Screen
        name="Users"
        component={UsersScreen}
        options={{ tabBarLabel: 'Users' }}
      />
    </Tab.Navigator>
  );
}

// --- WORKER MOBILE BOTTOM TABS ---
function WorkerTabNavigator() {
  const { user } = useAuth();
  useWorkerGroupsRealtime({ workerUserId: user?.id });
  useTaskLogsRealtime({ filterUserId: user?.id });
  const insets = useSafeAreaInsets();
  const bottomInset = insets?.bottom || 0;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          height: 60 + bottomInset,
          paddingBottom: Math.max(bottomInset, 8),
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'today';
          if (route.name === 'WorkerTodayTab') {
            iconName = focused ? 'today' : 'today-outline';
          } else if (route.name === 'ChooseWorkTab') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'WorkerReportTab') {
            iconName = focused ? 'document-text' : 'document-text-outline';
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
        name="WorkerReportTab"
        component={WorkerReportScreen}
        options={{ tabBarLabel: 'Report' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

const AdminWebStack = createNativeStackNavigator();

// Per-page wrappers that isolate crashes to the tab (sidebar stays up)
function withPageBoundary(Component, pageName) {
  return function BoundedPage(props) {
    return (
      <PageErrorBoundary pageName={pageName}>
        <Component {...props} />
      </PageErrorBoundary>
    );
  };
}

function ReportsRedirectStub({ navigation, route }) {
  const hasNavigated = React.useRef(false);
  useEffect(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    try {
      const state = navigation.getState();
      const routeNames = state?.routeNames || [];
      const reportGroupId = route?.params?.reportGroupId || route?.params?.groupId || null;
      const reportDate = route?.params?.reportDate || route?.params?.date || null;

      if (routeNames.includes('AdminCalendar')) {
        navigation.replace('AdminCalendar', {
          view: 'reports',
          reportGroupId,
          reportDate,
        });
      } else {
        navigation.navigate('AdminRoot', {
          screen: 'AdminCalendar',
          params: { view: 'reports', reportGroupId, reportDate },
        });
      }
    } catch (_) {
      try {
        navigation.navigate('AdminCalendar', { view: 'reports' });
      } catch (err) {
        if (__DEV__) console.warn('Redirect stub error:', err);
      }
    }
  }, [navigation, route]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
}

const SafeDashboard        = withPageBoundary(DashboardScreen,        'Dashboard');
const SafeScheduleCalendar = withPageBoundary(ScheduleCalendarScreen, 'Schedule Calendar');
const SafeReportsList      = withPageBoundary(ReportsRedirectStub,    'Reports');
const SafeReportDetail     = withPageBoundary(ReportsRedirectStub,    'Report Detail');
const SafeSetSchedule      = withPageBoundary(SetScheduleScreen,      'Set Schedule');
const SafeAssignWorkers    = withPageBoundary(AssignWorkersScreen,    'Assign Workers');
const SafeManageEquipment  = withPageBoundary(ManageEquipmentScreen,  'Equipment & Systems');
const SafePerformance      = withPageBoundary(PerformanceScreen,      'Performance Report');
const SafeSiteMap          = withPageBoundary(SiteMapScreen,          'Site Map');
const SafeUsers            = withPageBoundary(UsersScreen,            'User Roles');
const SafeActivityLogs     = withPageBoundary(ActivityLogsScreen,     'Activity Logs');
const SafeSettings         = withPageBoundary(SettingsScreen,         'Settings');
const SafeWorkerToday      = withPageBoundary(TodayScreen,            'Worker View');

// --- ADMIN WEB CONTAINER (STACK NAVIGATOR + SIDEBAR) ---
function ResponsiveAdminLayout({ navigation }) {
  useWorkerGroupsRealtime(); // Mount realtime once for admin area
  useTaskLogsRealtime(); // Mount task_logs realtime once for admin layout
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isNarrow = width < 900;
  const { sidebarOpen, closeSidebar } = useSidebar();
  const [activeTab, setActiveTab] = useState('Dashboard');

  // Persist visited tab for reload on root "/"
  const handleStateChange = useCallback((state) => {
    try {
      const currentRoute = state?.routes[state.index]?.name;
      if (currentRoute) {
        setActiveTab((prev) => (prev === currentRoute ? prev : currentRoute));
        AsyncStorage.setItem(LAST_ROUTE_KEY, currentRoute);
      }
    } catch (_) {}
  }, []);

  const handleNavigate = useCallback(
    (target, params) => {
      navigation.navigate('AdminRoot', { screen: target, params });
      if (isNarrow) {
        closeSidebar();
      }
    },
    [isNarrow, navigation, closeSidebar]
  );

  if (!isDesktop) {
    return <AdminTabNavigator />;
  }

  return (
    <View style={styles.webContainer}>
      {/* Desktop / Persistent Sidebar */}
      {!isNarrow && sidebarOpen && (
        <View style={styles.sidebarWrapper}>
          <WebSidebar
            activeRoute={activeTab}
            onNavigate={handleNavigate}
          />
        </View>
      )}

      {/* Narrow Screen Drawer Overlay with Backdrop */}
      {isNarrow && sidebarOpen && (
        <View style={styles.drawerBackdrop}>
          <TouchableOpacity
            style={styles.backdropClickable}
            onPress={closeSidebar}
            activeOpacity={1}
          />
          <View style={styles.drawerSidebarWrapper}>
            <WebSidebar
              activeRoute={activeTab}
              onNavigate={handleNavigate}
              onClose={closeSidebar}
            />
          </View>
        </View>
      )}

      <View style={styles.webMainContent}>
        <AdminWebStack.Navigator
          initialRouteName="Dashboard"
          screenOptions={{ headerShown: false }}
          screenListeners={{
            state: (e) => handleStateChange(e.data?.state),
          }}
        >
          <AdminWebStack.Screen name="Dashboard" component={SafeDashboard} />
          <AdminWebStack.Screen name="AdminCalendar" component={SafeScheduleCalendar} />
          <AdminWebStack.Screen name="ReportsList" component={SafeReportsList} />
          <AdminWebStack.Screen name="ReportDetail" component={SafeReportDetail} />
          <AdminWebStack.Screen name="SetSchedule" component={SafeSetSchedule} />
          <AdminWebStack.Screen name="AssignWorkers" component={SafeAssignWorkers} />
          <AdminWebStack.Screen name="ManageEquipment" component={SafeManageEquipment} />
          <AdminWebStack.Screen name="Performance" component={SafePerformance} />
          <AdminWebStack.Screen name="SiteMap" component={SafeSiteMap} />
          <AdminWebStack.Screen name="Users" component={SafeUsers} />
          <AdminWebStack.Screen name="ActivityLogs" component={SafeActivityLogs} />
          <AdminWebStack.Screen name="Settings" component={SafeSettings} />
          <AdminWebStack.Screen name="WorkerToday" component={SafeWorkerToday} />
          <AdminWebStack.Screen name="NotFound" component={NotFoundScreen} />
        </AdminWebStack.Navigator>
      </View>
    </View>
  );
}

function ResponsiveWorkerLayout({ navigation }) {
  const { user } = useAuth();
  useWorkerGroupsRealtime({ workerUserId: user?.id });
  useTaskLogsRealtime({ filterUserId: user?.id });
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  if (!isDesktop) {
    return <WorkerTabNavigator />;
  }

  return (
    <View style={styles.webContainer}>
      <WebSidebar
        activeRoute="WorkerToday"
        onNavigate={(routeKey) => navigation.navigate(routeKey)}
      />
      <View style={styles.webMainContent}>
        <TodayScreen navigation={navigation} />
      </View>
    </View>
  );
}

// --- MAIN ROOT STACK ---
export default function AppNavigator() {
  const { user, loading, isAccountDisabled, setIsAccountDisabled } = useAuth();
  const { settings } = useAppSettings();

  // Full-screen restoration loader
  if (loading) {
    return (
      <View style={styles.center}>
        <LoadingSkeleton message="Initializing Solar PM Hub..." />
      </View>
    );
  }

  // Account disabled gate
  if (isAccountDisabled && user?.role !== 'admin') {
    return (
      <DisabledAccountScreen
        onBackToLogin={() => setIsAccountDisabled(false)}
      />
    );
  }

  // Plant Maintenance mode (blocks workers and unauthenticated guests on mobile)
  if (settings?.maintenance_mode && user?.role !== 'admin' && Platform.OS !== 'web') {
    return <MaintenanceScreen />;
  }

  return (
    <NavigationContainer
      linking={linking}
      fallback={
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      }
      onUnhandledAction={(action) => {
        if (__DEV__) {
          console.warn('[Navigation] Unhandled navigation action suppressed:', action);
        }
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Unauthenticated
          Platform.OS === 'web' ? (
            <>
              <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
              <Stack.Screen name="AuthConfirmed" component={AuthConfirmedScreen} />
              <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
              <Stack.Screen name="NotFound" component={NotFoundScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="WorkerLogin" component={WorkerLoginScreen} />
              <Stack.Screen name="WorkerSignUp" component={WorkerSignUpScreen} />
              <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
              <Stack.Screen name="AuthConfirmed" component={AuthConfirmedScreen} />
              <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            </>
          )
        ) : user.role === 'admin' ? (
          // Authenticated Admin
          <>
            <Stack.Screen name="AdminRoot" component={ResponsiveAdminLayout} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="AuthConfirmed" component={AuthConfirmedScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen name="NotFound" component={NotFoundScreen} />
          </>
        ) : (
          // Authenticated Worker
          <>
            <Stack.Screen name="WorkerRoot" component={ResponsiveWorkerLayout} />
            <Stack.Screen name="AuthConfirmed" component={AuthConfirmedScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen name="NotFound" component={NotFoundScreen} />
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
    position: 'relative',
  },
  sidebarWrapper: {
    height: '100%',
    zIndex: 10,
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
    flexDirection: 'row',
  },
  backdropClickable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawerSidebarWrapper: {
    height: '100%',
    zIndex: 1000,
  },
  webMainContent: {
    flex: 1,
    height: '100%',
  },
});
