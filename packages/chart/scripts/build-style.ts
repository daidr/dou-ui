// Ship `@dou-ui/chart/style.css` and the `@dou-ui/chart/style` entry.
import { buildPackageStyle } from '../../dou-ui/scripts/ecosystem-style'

await buildPackageStyle(new URL('../', import.meta.url))
