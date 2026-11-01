// Ship `@dou-ui/pivot/style.css` and the `@dou-ui/pivot/style` entry.
import { buildPackageStyle } from '../../dou-ui/scripts/ecosystem-style'

await buildPackageStyle(new URL('../', import.meta.url))
