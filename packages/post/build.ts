import { dts } from 'bun-plugin-dtsx'

// eslint-disable-next-line ts/no-top-level-await
const _resp = await Bun.build({
  target: 'bun',
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  plugins: [dts()],
})

// eslint-disable-next-line ts/no-top-level-await
const _resp2 = await Bun.build({
  target: 'bun',
  entrypoints: ['./bin/cli.ts'],
  outdir: './dist',
  plugins: [dts()],
})
