import { mkdir, writeFile } from 'node:fs/promises'

// eslint-disable-next-line ts/no-top-level-await
await Bun.build({
  target: 'bun',
  entrypoints: ['./index.ts'],
  outdir: './dist',
})

// eslint-disable-next-line ts/no-top-level-await
await mkdir('./dist', { recursive: true })
// eslint-disable-next-line ts/no-top-level-await
await writeFile('./dist/index.d.ts', 'export declare const wip2: true\n')
