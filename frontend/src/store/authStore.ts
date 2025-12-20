import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  phone_number: string
  first_name: string
  last_name: string
  role: string
  status: string
  school_id: string
  campus_id: string | null
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  isAuthenticated: boolean
  setAuth: (accessToken: string, refreshToken: string, user: User) => void
  clearAuth: () => void
  updateAccessToken: (token: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      setAuth: (accessToken, refreshToken, user) =>
        set({
          accessToken,
          refreshToken,
          user,
          isAuthenticated: true,
        }),
      clearAuth: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),
      updateAccessToken: (token) =>
        set({ accessToken: token }),
    }),
    {
      name: 'auth-storage',
    }
  )
)

