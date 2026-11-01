// Ship `@dou-ui/form-builder/style.css` and the `@dou-ui/form-builder/style` entry.
import { buildPackageStyle } from '../../dou-ui/scripts/ecosystem-style'

await buildPackageStyle(new URL('../', import.meta.url))
