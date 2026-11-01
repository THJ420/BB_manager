import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing, typography } from '@/theme/tokens'

type ToastTone = 'info' | 'error' | 'success'

interface ToastMessage {
  id: number
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneColor: Record<ToastTone, string> = {
  info: colors.info,
  error: colors.danger,
  success: colors.success,
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    if (timer.current) {
      clearTimeout(timer.current)
    }

    setToast({ id: Date.now(), message, tone })
    timer.current = setTimeout(() => setToast(null), 4500)
  }, [])

  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current)
    }
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={styles.viewport}>
          <View style={[styles.toast, { borderColor: toneColor[toast.tone] }]}>
            <View style={[styles.toneDot, { backgroundColor: toneColor[toast.tone] }]} />
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider')
  }

  return context
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 92,
    zIndex: 900,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 560,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  toneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    ...typography.label,
    color: colors.text,
    flexShrink: 1,
  },
})
