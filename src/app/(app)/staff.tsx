import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../components/ActionButton';
import { DialogModal } from '../../components/DialogModal';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StaffAccountModal, StaffFormValues } from '../../components/StaffAccountModal';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { branchDisplayName } from '../../lib/branchLabel';
import { initials, roleLabel } from '../../lib/format';
import {
  createStaffAccount,
  fetchBranchStaff,
  resetStaffPassword,
  revokeStaffAccount,
  StaffAccount,
} from '../../services/staff';
import { useApp } from '../../state/AppProvider';
import { Colors, Radius, Spacing } from '../../theme/colors';

export default function StaffManagementScreen() {
  const router = useRouter();
  const { state } = useApp();
  const branchId = state.ownerWorkspaceBranchId ?? '';
  const branch = state.branches.find((entry) => entry.id === branchId);
  const branchLabel = branch ? branchDisplayName(branch) : state.activeBranch.name;

  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'reset'>('create');
  const [modalVisible, setModalVisible] = useState(false);
  const [target, setTarget] = useState<StaffAccount | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<StaffAccount | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoadError(null);
    try {
      setAccounts(await fetchBranchStaff(branchId));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load staff accounts.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const { refreshing, onRefresh } = usePullToRefresh(load);

  const sorted = useMemo(
    () => [...accounts].sort((a, b) => a.username.localeCompare(b.username)),
    [accounts]
  );

  // Employee accounts are a per-branch owner tool, never a network-wide one.
  if (state.session?.role !== 'owner' || !branchId) {
    return <Redirect href="/(app)/analytics" />;
  }

  const openCreate = () => {
    setTarget(null);
    setModalMode('create');
    setModalVisible(true);
  };

  const openReset = (account: StaffAccount) => {
    setTarget(account);
    setModalMode('reset');
    setModalVisible(true);
  };

  const handleSubmit = async (values: StaffFormValues) => {
    if (modalMode === 'reset') {
      if (!target) return;
      await resetStaffPassword(target.id, values.password);
    } else {
      await createStaffAccount({
        branchId,
        username: values.username,
        password: values.password,
        name: values.name,
        role: values.role,
        email: values.email,
      });
    }
    await load();
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      await revokeStaffAccount(revokeTarget.id);
      setRevokeTarget(null);
      await load();
    } catch (error) {
      setRevokeError(error instanceof Error ? error.message : 'Unable to revoke the account.');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Staff Management"
        subtitle={`${branchLabel} • ${accounts.length} employee ${
          accounts.length === 1 ? 'account' : 'accounts'
        }`}
        right={
          <ActionButton
            label="+ CREATE"
            variant="primary"
            compact
            onPress={openCreate}
            testID="btn_create_staff"
          />
        }
        bottom={
          <ActionButton
            label="‹  BACK TO STORE SETTINGS"
            variant="outline"
            onPress={() => router.replace('/(app)/settings')}
            testID="btn_staff_back"
          />
        }
      />

      <FlatList
        data={sorted}
        keyExtractor={(account) => account.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            progressBackgroundColor={Colors.surfaceElevated}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card} testID={`staff_account_${item.username}`}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(item.name)}</Text>
              </View>
              <View style={styles.identity}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.username} numberOfLines={1}>
                  {item.username}
                </Text>
              </View>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{roleLabel(item.role)}</Text>
              </View>
            </View>

            <Text style={styles.meta} numberOfLines={1}>
              {item.email}
            </Text>
            <Text style={styles.scope}>Locked to {branchLabel}</Text>

            <View style={styles.actions}>
              <ActionButton
                label="RESET PASSWORD"
                variant="subtle"
                compact
                onPress={() => openReset(item)}
                style={styles.action}
                testID={`btn_staff_reset_${item.username}`}
              />
              <ActionButton
                label="REVOKE"
                variant="dangerOutline"
                compact
                onPress={() => {
                  setRevokeError(null);
                  setRevokeTarget(item);
                }}
                style={styles.action}
                testID={`btn_staff_revoke_${item.username}`}
              />
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          loadError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{loadError}</Text>
              <ActionButton
                label="RETRY"
                variant="outline"
                compact
                onPress={() => void load()}
                testID="btn_staff_retry"
              />
            </View>
          ) : (
            <Text style={styles.intro}>
              Each account signs in with its username and password and can only ever open
              this store&apos;s terminal.
            </Text>
          )
        }
        ListEmptyComponent={
          loading ? undefined : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔑</Text>
              <Text style={styles.emptyTitle}>No employee accounts yet</Text>
              <Text style={styles.emptySub}>
                Create a username and password to give this store its own terminal login.
              </Text>
            </View>
          )
        }
      />

      <StaffAccountModal
        visible={modalVisible}
        mode={modalMode}
        branchLabel={branchLabel}
        account={target}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />

      <DialogModal
        visible={revokeTarget !== null}
        title="Revoke employee account?"
        message={
          revokeTarget
            ? `${revokeTarget.username} will no longer be able to sign in to ${branchLabel}. This cannot be undone.`
            : undefined
        }
        onRequestClose={() => setRevokeTarget(null)}
        actions={[
          {
            label: 'CANCEL',
            variant: 'outline',
            onPress: () => setRevokeTarget(null),
          },
          {
            label: revoking ? 'REVOKING…' : 'REVOKE ACCESS',
            variant: 'danger',
            onPress: () => void confirmRevoke(),
          },
        ]}
      >
        {revokeError ? <Text style={styles.errorText}>{revokeError}</Text> : null}
      </DialogModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 32,
  },
  separator: {
    height: 12,
  },
  intro: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.primary,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  username: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  rolePill: {
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 120,
  },
  rolePillText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: Colors.textMuted,
  },
  meta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  scope: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.success,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  action: {
    flex: 1,
  },
  errorBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.error,
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
});