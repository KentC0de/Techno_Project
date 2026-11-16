import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../theme';

/**
 * SetScheduleScreen (Redirect):
 * "Set Schedule" has been replaced by the "Add Task" modal on ScheduleCalendarScreen.
 * Any deep-link or navigation to 'SetSchedule' cleanly redirects to 'AdminCalendar' with openAddTask: true.
 */
export default function SetScheduleScreen({ navigation }) {
  useEffect(() => {
    if (navigation?.replace) {
      navigation.replace('AdminCalendar', { openAddTask: true });
    } else if (navigation?.navigate) {
      navigation.navigate('AdminCalendar', { openAddTask: true });
    }
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
