import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const pattern = /const \{ parse, parseAsync, xxhashBase64Url, xxhashBase36, xxhashBase16 \} = requireWithFriendlyError\(\s*existsSync\(path\.join\(__dirname, localName\)\) \? localName : `@rollup\/rollup-\$\{packageBase\}`\s*\);\n/

const replacement = `let rollupBindings;\ntry {\n\trollupBindings = requireWithFriendlyError(\n\t\texistsSync(path.join(__dirname, localName)) ? localName : \`@rollup/rollup-\${packageBase}\`\n\t);\n} catch {\n\trollupBindings = require('@rollup/wasm-node/dist/native.js');\n}\nconst { parse, parseAsync, xxhashBase64Url, xxhashBase36, xxhashBase16 } = rollupBindings;\n`

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pnpmDir = resolve(rootDir, 'node_modules', '.pnpm')

if (!existsSync(pnpmDir)) {
  process.exit(0)
}

const rollupNativePaths = readdirSync(pnpmDir)
  .filter(entry => entry.startsWith('rollup@'))
  .map(entry => resolve(pnpmDir, entry, 'node_modules', 'rollup', 'dist', 'native.js'))
  .filter(existsSync)

for (const nativeJsPath of rollupNativePaths) {
  const source = readFileSync(nativeJsPath, 'utf8')
  if (source.includes("require('@rollup/wasm-node/dist/native.js')")) {
    continue
  }
  if (!pattern.test(source)) {
    throw new Error(`Unexpected Rollup native loader format: ${nativeJsPath}`)
  }
  writeFileSync(nativeJsPath, source.replace(pattern, replacement), 'utf8')
}
