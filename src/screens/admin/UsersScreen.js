import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { fetchProfiles, updateProfileRole } from '../../lib/dataService';
import Header from '../../components/Header';
import { colors, layout } from '../../theme';

export default function UsersScreen({ navigation }) {
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProfiles();
      setProfiles(data);
    } catch (err) {
      console.warn('Error fetching profiles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleRole = async (profile) => {
    const nextRole = profile.role === 'admin' ? 'worker' : 'admin';
    try {
      setUpdatingId(profile.id);
      await updateProfileRole(profile.id, nextRole);
      setMessage(`Updated ${profile.full_name}'s role to ${nextRole.toUpperCase()}`);
      await loadData();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to update user role.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        title="User Roles"
        subtitle="Manage administrator and field worker permissions"
        navigation={navigation}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {message ? (
          <View style={styles.messageBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.primaryDark} style={{ marginRight: 8 }} />
          <Text style={styles.infoText}>
            Admins have permission to configure equipment, create schedule rules, and analyze performance reports. Field workers have streamlined access to mark maintenance tasks.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <View style={styles.userList}>
            {profiles.map((p) => {
              const isMe = p.id === currentUser?.id;
              const isAdmin = p.role === 'admin';
              return (
                <View key={p.id} style={styles.userCard}>
                  <View style={styles.userLeft}>
                    <View
                      style={[
                        styles.avatar,
                        isAdmin ? styles.avatarAdmin : styles.avatarWorker,
                      ]}
                    >
                      <Ionicons
                        name={isAdmin ? 'shield-outline' : 'person-outline'}
                        size={20}
                        color={colors.white}
                      />
                    </View>

                    <View style={styles.userMeta}>
                      <View style={styles.nameRow}>
                        <Text style={styles.fullName}>{p.full_name || 'User'}</Text>
                        {isMe && (
                          <View style={styles.youBadge}>
                            <Text style={styles.youText}>You</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.userRoleText}>
                        Role: <Text style={{ fontWeight: '700', color: colors.dark }}>{p.role}</Text>
                        {p.created_at ? ` • Added ${p.created_at.slice(0, 10)}` : ''}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.roleToggleBtn,
                      isAdmin ? styles.btnAdmin : styles.btnWorker,
                    ]}
                    onPress={() => handleToggleRole(p)}
                    disabled={updatingId === p.id}
                  >
                    {updatingId === p.id ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <>
                        <Ionicons
                          name="swap-horizontal"
                          size={14}
                          color={colors.white}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.roleToggleBtnText}>
                          Make {isAdmin ? 'Worker' : 'Admin'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  messageText: {
    color: '#065F46',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryVeryLight,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    color: colors.primaryDark,
    lineHeight: 18,
    flex: 1,
  },
  userList: {
    gap: 10,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: layout.minTouchTarget,
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarAdmin: {
    backgroundColor: colors.dark,
  },
  avatarWorker: {
    backgroundColor: colors.primary,
  },
  userMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fullName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
  },
  youBadge: {
    backgroundColor: colors.primaryVeryLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  youText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  userRoleText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  roleToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 40,
  },
  btnAdmin: {
    backgroundColor: colors.textSecondary,
  },
  btnWorker: {
    backgroundColor: colors.primary,
  },
  roleToggleBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});

