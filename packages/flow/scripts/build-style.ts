// Ship `@dou-ui/flow/style.css` and the `@dou-ui/flow/style` entry.
import { buildPackageStyle } from '../../dou-ui/scripts/ecosystem-style'

await buildPackageStyle(new URL('../', import.meta.url))
