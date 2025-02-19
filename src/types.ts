export interface MailServerConfig {
  verbose: boolean
}

export interface AuthOptions {
  method: string
  username?: string
  password?: string
  accessToken?: string
  challenge?: string
  challengeResponse?: string
  validatePassword?: (password: string) => boolean
}

export interface AuthResponse {
  user?: any
  data?: {
    status?: string
    schemes?: string
    scope?: string
  }
  message?: string
  responseCode?: number
}

export interface AuthError extends Error {
  responseCode?: number
}

export type AuthCallback = (error: AuthError | null, response?: AuthResponse) => void
