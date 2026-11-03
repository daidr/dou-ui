import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sorted } from './sorted'

export interface WorkspacePackage {
  /** Directory name under `packages/`, e.g. `sheet`. */
  dir: string
  /** Absolute path of the package directory. */
  path: string
  name: string
  version: string
  /** Names of other published workspace packages this one needs. */
  internal: string[]
}

type Manifest = {
  name: string
  version: string
  private?: boolean
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

/**
 * The packages that get published, in an order where every package comes
 * after the packages it depends on.
 */
export function readPackages(root: string): WorkspacePackage[] {
  const dirs = sorted(
    readdirSync(join(root, 'packages'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  )
  const manifests = new Map<string, Manifest & { dir: string }>()
  for (const dir of dirs) {
    let pkg: Manifest
    try {
      pkg = JSON.parse(readFileSync(join(root, 'packages', dir, 'package.json'), 'utf8'))
    } catch {
      continue
    }
    if (pkg.private) continue
    manifests.set(pkg.name, { ...pkg, dir })
  }
  const packages = [...manifests.values()].map<WorkspacePackage>((pkg) => ({
    dir: pkg.dir,
    path: join(root, 'packages', pkg.dir),
    name: pkg.name,
    version: pkg.version,
    internal: sorted(
      Object.keys({
        ...pkg.dependencies,
        ...pkg.peerDependencies,
        ...pkg.optionalDependencies,
      }).filter((name) => manifests.has(name) && name !== pkg.name),
    ),
  }))
  return sortByDependencies(packages)
}

/** Dependencies first; ties keep their given order. Throws on a cycle. */
export function sortByDependencies<T extends { name: string; internal: string[] }>(
  packages: T[],
): T[] {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]))
  const done = new Set<string>()
  const visiting = new Set<string>()
  const order: T[] = []
  const visit = (pkg: T, path: string[]) => {
    if (done.has(pkg.name)) return
    if (visiting.has(pkg.name)) {
      throw new Error(`包之间存在循环依赖：${[...path, pkg.name].join(' → ')}`)
    }
    visiting.add(pkg.name)
    for (const name of pkg.internal) {
      const dep = byName.get(name)
      if (dep) visit(dep, [...path, pkg.name])
    }
    visiting.delete(pkg.name)
    done.add(pkg.name)
    order.push(pkg)
  }
  for (const pkg of packages) visit(pkg, [])
  return order
}
