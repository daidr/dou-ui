// Ship `@dou-ui/gantt/style.css` and the `@dou-ui/gantt/style` entry.
import { buildPackageStyle } from '../../dou-ui/scripts/ecosystem-style'

await buildPackageStyle(new URL('../', import.meta.url))
