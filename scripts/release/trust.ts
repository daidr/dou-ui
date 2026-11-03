/**
 * Configure npm trusted publishing for every published package, so the
 * release workflow can publish without a token. Run once, locally, after the
 * packages exist on npm. Needs npm 11.15 or newer and two-factor auth.
 *
 *   bun run release:trust
 */
import { root } from './repo'
import { readPackages } from './workspace'

const print = (text: string) => process.stdout.write(`${text}\n`)

const repo = 'daidr/dou-ui'
const workflow = 'release.yml'
const environment = 'npm'

for (const pkg of readPackages(root)) {
  const args = [
    'npm',
    'trust',
    'github',
    pkg.name,
    '--repo',
    repo,
    '--file',
    workflow,
    '--env',
    environment,
    '--allow-publish',
    '--yes',
  ]
  print(`$ ${args.join(' ')}`)
  const result = Bun.spawnSync(args, { cwd: root, stdio: ['inherit', 'inherit', 'inherit'] })
  if (result.exitCode !== 0) {
    console.error(`${pkg.name} 配置失败。已有配置时先用 npm trust list ${pkg.name} 查看并撤销。`)
    process.exit(1)
  }
}
print('全部包已配置可信发布。')
