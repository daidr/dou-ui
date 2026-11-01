// Ship `@dou-ui/editor/style.css` and the `@dou-ui/editor/style` entry.
import { buildPackageStyle } from '../../dou-ui/scripts/ecosystem-style'

await buildPackageStyle(new URL('../', import.meta.url))
