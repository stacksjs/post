import { dts } from 'bun-plugin-dtsx'

// eslint-disable-next-line no-console
console.log('Building...')

// eslint-disable-next-line ts/no-top-level-await
await Bun.build({
  entrypoints: ['./src/index.ts', './bin/cli.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',
  minify: true,
  splitting: true,
  plugins: [dts()],
})

// eslint-disable-next-line no-console
console.log('Built')
