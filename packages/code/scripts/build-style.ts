// Ship `@dou-ui/code/style.css` and the `@dou-ui/code/style` entry.
import { buildPackageStyle } from '../../dou-ui/scripts/ecosystem-style'

await buildPackageStyle(new URL('../', import.meta.url))
