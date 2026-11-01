// Ship `@dou-ui/dashboard/style.css` and the `@dou-ui/dashboard/style` entry.
import { buildPackageStyle } from '../../dou-ui/scripts/ecosystem-style'

await buildPackageStyle(new URL('../', import.meta.url))
