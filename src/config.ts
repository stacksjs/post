import type { MailServerConfig } from './types'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadConfig } from 'bunfig'

export const defaultConfig: MailServerConfig = {
  verbose: true,
}

// @ts-expect-error dtsx issue
// eslint-disable-next-line antfu/no-top-level-await
export const config: ProxyConfig = await loadConfig({
  name: 'mail-server',
  cwd: resolve(__dirname, '..'),
  defaultConfig,
})
