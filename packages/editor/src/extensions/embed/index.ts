import { AppWindowIcon } from '@dou-ui/icons'
import { defineComponent, h } from 'vue'
import type { EditorExtension } from '../../core/extension'
import { escapeHTML, escapeMarkdown } from '../../core/output'
import { defineBlock } from '../../define-block'
import EmbedBlock from './embed-block.vue'
import {
  checkTarget,
  frameAllow,
  frameSandbox,
  httpsUrl,
  ratioOf,
  resolveEmbed,
  type EmbedResolver,
  type EmbedTarget,
} from './targets'

export interface EmbedOptions {
  /**
   * Turn a link into what the block shows: a frame, a video or an audio
   * player, or `null` to refuse it. The block keeps the link itself, so a
   * changed resolver applies to documents already written. Only https
   * addresses are ever loaded. By default media files play in the browser's
   * player and other pages show in a frame.
   */
  resolve?: EmbedResolver
}

function attrsOf(dom: HTMLElement) {
  const src =
    dom.dataset.embed ?? dom.getAttribute('src') ?? dom.querySelector('[src]')?.getAttribute('src')
  if (!src || !httpsUrl(src)) return false
  return {
    src,
    caption:
      dom.querySelector('figcaption')?.textContent?.trim() ?? dom.getAttribute('title') ?? '',
  }
}

function playerHTML(target: EmbedTarget, title: string): string {
  const src = escapeHTML(target.src)
  if (target.kind === 'video')
    return `<video src="${src}" controls preload="metadata" style="aspect-ratio: ${ratioOf(target)}"></video>`
  if (target.kind === 'audio') return `<audio src="${src}" controls preload="metadata"></audio>`
  const size = target.height
    ? `height: ${Number(target.height)}px`
    : `aspect-ratio: ${ratioOf(target)}`
  return `<iframe src="${src}" title="${escapeHTML(title)}" sandbox="${frameSandbox}" allow="${frameAllow}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" style="width: 100%; ${size}"></iframe>`
}

/**
 * Embed blocks: a web page, a video or an audio file from a link, with a
 * caption. Only https links are embedded.
 */
export function embed(options: EmbedOptions = {}): EditorExtension {
  const resolve = (url: string) => {
    if (!httpsUrl(url)) return null
    return checkTarget((options.resolve ?? resolveEmbed)(url.trim()))
  }
  const View = defineComponent({
    name: 'DouEditorEmbedView',
    inheritAttrs: false,
    setup(_props, { attrs }) {
      return () => h(EmbedBlock, { ...attrs, resolve } as never)
    },
  })
  const block = defineBlock({
    type: 'embed',
    props: { src: '', caption: '' },
    content: 'none',
    component: View,
    menu: {
      label: (m) => m.types.embed,
      hint: (m) => m.hints.embed,
      icon: AppWindowIcon,
      keywords: ['embed', 'video', 'audio', 'iframe', 'qr', 'qianru', 'shipin', 'yinpin'],
    },
    spec: {
      parseDOM: [
        { tag: 'figure[data-embed]', priority: 60, getAttrs: (dom) => attrsOf(dom as HTMLElement) },
        { tag: 'iframe[src]', getAttrs: (dom) => attrsOf(dom as HTMLElement) },
        { tag: 'video', getAttrs: (dom) => attrsOf(dom as HTMLElement) },
        { tag: 'audio', getAttrs: (dom) => attrsOf(dom as HTMLElement) },
      ],
      // the link only: frames load in the view, not in what is copied
      toDOM: (node) =>
        [
          'figure',
          {
            class: 'dou-editor__content dou-editor__content--embed',
            'data-content-type': 'embed',
            'data-embed': httpsUrl(String(node.attrs.src)) ? node.attrs.src : null,
          },
          ...(node.attrs.caption ? [['figcaption', node.attrs.caption]] : []),
        ] as never,
    },
  })
  return {
    ...block,
    output: {
      blocks: {
        embed: {
          html: (node, { children }) => {
            const link = String(node.props.src ?? '')
            const caption = String(node.props.caption ?? '')
            const target = resolve(link)
            if (!target) return children
            const figcaption = caption ? `<figcaption>${escapeHTML(caption)}</figcaption>` : ''
            return `<figure data-embed="${escapeHTML(link)}">${playerHTML(target, caption || link)}${figcaption}</figure>${children}`
          },
          markdown: (node, { children }) => {
            const link = String(node.props.src ?? '')
            if (!resolve(link)) return children
            const address = /[\s()<>]/.test(link) ? `<${link}>` : link
            const written = `[${escapeMarkdown(String(node.props.caption || link))}](${address})`
            return children ? `${written}\n\n${children}` : written
          },
        },
      },
    },
  }
}

export { resolveEmbed, type EmbedResolver, type EmbedTarget }
