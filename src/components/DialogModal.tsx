import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionButton, ButtonVariant } from './ActionButton';
import { ModalShell } from './ModalShell';

export interface DialogAction {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
}

export interface DialogModalProps {
  visible: boolean;
  title: string;
  message?: string;
  children?: ReactNode;
  actions: DialogAction[];
  onRequestClose: () => void;
}

export function DialogModal({
  visible,
  title,
  message,
  children,
  actions,
  onRequestClose,
}: DialogModalProps) {
  return (
    <ModalShell
      visible={visible}
      title={title}
      subtitle={message}
      onClose={onRequestClose}
      scroll={false}
      footer={
        <View style={styles.actions}>
          {actions.map((action) => (
            <ActionButton
              key={action.label}
              label={action.label}
              variant={action.variant ?? 'primary'}
              onPress={action.onPress}
              style={styles.action}
            />
          ))}
        </View>
      }
    >
      {children ? <View style={styles.body}>{children}</View> : null}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    flex: 1,
  },
  body: {
    gap: 8,
  },
});
