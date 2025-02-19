import { beforeAll, describe, expect, it } from 'bun:test'

describe('@stacksjs/mail-server', () => {
  beforeAll(() => {
    process.env.APP_ENV = 'test'
  })

  it('should work', async () => {
    expect(true).toBe(true)
  })
})
