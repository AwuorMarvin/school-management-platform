import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
  showToast: (message: string, type?: ToastType, duration?: number) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  
  addToast: (message: string, type: ToastType = 'info', duration: number = 5000) => {
    const id = Math.random().toString(36).substring(2, 9)
    const toast: Toast = { id, message, type, duration }
    
    set((state) => ({ toasts: [...state.toasts, toast] }))
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
    }
    
    return id
  },
  
  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
  
  showToast: (message: string, type: ToastType = 'info', duration?: number) => {
    useToastStore.getState().addToast(message, type, duration)
  },
  
  success: (message: string, duration?: number) => {
    useToastStore.getState().addToast(message, 'success', duration)
  },
  
  error: (message: string, duration?: number) => {
    useToastStore.getState().addToast(message, 'error', duration)
  },
  
  info: (message: string, duration?: number) => {
    useToastStore.getState().addToast(message, 'info', duration)
  },
  
  warning: (message: string, duration?: number) => {
    useToastStore.getState().addToast(message, 'warning', duration)
  },
}))

