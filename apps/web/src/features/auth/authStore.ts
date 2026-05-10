import { create } from 'zustand'

import { authClient, type AuthUser } from './authClient'

type Status = 'unknown' | 'authenticated' | 'anonymous'

interface AuthState {
  status: Status
  user: AuthUser | null
  init: () => Promise<void>
  signup: (email: string, password: string) => Promise<AuthUser>
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  setUser: (user: AuthUser | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  init: async () => {
    try {
      const { user } = await authClient.me()
      set({ status: 'authenticated', user })
    } catch {
      set({ status: 'anonymous', user: null })
    }
  },
  signup: async (email, password) => {
    const { user } = await authClient.signup(email, password)
    set({ status: 'authenticated', user })
    return user
  },
  login: async (email, password) => {
    const { user } = await authClient.login(email, password)
    set({ status: 'authenticated', user })
    return user
  },
  logout: async () => {
    await authClient.logout()
    set({ status: 'anonymous', user: null })
  },
  setUser: (user) => set({ status: user ? 'authenticated' : 'anonymous', user }),
}))
