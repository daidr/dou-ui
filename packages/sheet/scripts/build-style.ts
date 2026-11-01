// Ship `@dou-ui/sheet/style.css` and the `@dou-ui/sheet/style` entry.
import { buildPackageStyle } from '../../dou-ui/scripts/ecosystem-style'

await buildPackageStyle(new URL('../', import.meta.url))
