import type { ChatArtifactKind, ChatArtifactStatus } from '../chat-artifact/chat-artifact'
import type { ChatAttachment } from '../chat-attachments/chat-attachments'
import type {
  ChatConfirmDecision,
  ChatConfirmStatus,
  ChatConfirmTone,
} from '../chat-confirm/chat-confirm'
import type { ChatPlanItem } from '../chat-plan/chat-plan'
import type { ChatQuestionOption, ChatQuestionStatus } from '../chat-question/chat-question'
import type { ChatSource } from '../chat-sources/chat-sources'
import type { ChatStep } from '../chat-steps/chat-steps'
import type { ChatToolCallStatus } from '../chat-tool-call/chat-tool-call'
import type { MarkdownProps, MarkdownSlots } from '../markdown/markdown'

/** Options for the Markdown of text and reasoning parts. */
export type ChatMessageMarkdown = Pick<
  MarkdownProps,
  'smooth' | 'speed' | 'caret' | 'linkTarget' | 'sanitizeUrl'
>

/** Who wrote the message. */
export type ChatMessageSender = 'user' | 'assistant' | 'system'

/** When the bar of actions over a message shows. */
export type ChatMessageActionsVisible = 'always' | 'hover'

/** One kind of reaction on a message, e.g. 👍 from three people. */
export interface ChatMessageReaction {
  /** The emoji, or any key the app knows the reaction by; shown as is unless the `reaction` slot renders it. */
  emoji: string
  /** How many reacted this way. A reaction at 0 is not shown. */
  count: number
  /** The person reacted this way too; pressing it again takes theirs back. */
  reacted?: boolean
  /** More about it, e.g. who reacted; read out and shown on hover after the emoji and count. */
  label?: string
}

export interface ChatTextPart {
  type: 'text'
  text: string
  /** More text is still coming. */
  streaming?: boolean
}
export interface ChatReasoningPart {
  type: 'reasoning'
  text: string
  thinking?: boolean
  /** Seconds it took. */
  duration?: number
}
export interface ChatToolPart {
  type: 'tool'
  name?: string
  title?: string
  status?: ChatToolCallStatus
  input?: unknown
  output?: unknown
  live?: boolean
}
export interface ChatStepsPart {
  type: 'steps'
  items: ChatStep[]
  live?: boolean
  title?: string
}
export interface ChatPlanPart {
  type: 'plan'
  items: ChatPlanItem[]
  title?: string
  collapsible?: boolean
  live?: boolean
}
export interface ChatSourcesPart {
  type: 'sources'
  items: ChatSource[]
}
export interface ChatFilesPart {
  type: 'files'
  files: ChatAttachment[]
}
export interface ChatArtifactPart {
  type: 'artifact'
  /** Handed back with `artifact`, to tell artifacts apart. */
  id?: string | number
  title: string
  kind?: ChatArtifactKind
  /** Below the title. While running it shimmers; left out, the line reads "Generating". */
  description?: string
  status?: ChatArtifactStatus
  active?: boolean
}
export interface ChatConfirmPart {
  type: 'confirm'
  /** Handed back with `confirm`, to tell requests apart. */
  id?: string | number
  title: string
  description?: string
  status?: ChatConfirmStatus
  allowAlways?: boolean
  tone?: ChatConfirmTone
  /** Shown as monospace detail, e.g. the command to run or a diff. */
  detail?: string
}
export interface ChatQuestionPart {
  type: 'question'
  /** Handed back with `question`, to tell questions apart. */
  id?: string | number
  title: string
  description?: string
  options: ChatQuestionOption[]
  status?: ChatQuestionStatus
  /** The `value` of the option chosen. */
  answer?: string | number
}
/** Any other part; render it with the `part` slot. */
export interface ChatCustomPart {
  type: string
  [key: string]: unknown
}

export type ChatMessagePart =
  | ChatTextPart
  | ChatReasoningPart
  | ChatToolPart
  | ChatStepsPart
  | ChatPlanPart
  | ChatSourcesPart
  | ChatFilesPart
  | ChatArtifactPart
  | ChatConfirmPart
  | ChatQuestionPart

export interface ChatMessageProps {
  sender?: ChatMessageSender
  /**
   * What the message is made of, in order: text, reasoning, tool calls,
   * steps, a plan, sources, files, artifacts, confirmations and questions may follow
   * one another in any order.
   */
  parts?: (ChatMessagePart | ChatCustomPart)[]
  /** Shorthand for a message of one text part. */
  content?: string
  /**
   * Render text and reasoning parts as Markdown, streaming included. `[1]`
   * in the text becomes a citation of the message's sources parts. An
   * object turns it on with options for the Markdown component, such as
   * `sanitizeUrl`. Set it for every message in the ConfigProvider's
   * `defaults`.
   */
  markdown?: boolean | ChatMessageMarkdown
  /** No part has arrived yet: show the waiting dots, like ChatBubble's. */
  loading?: boolean
  /**
   * When the bar of actions over the top right corner shows: `'always'`,
   * or `'hover'` while the pointer is over the message, focus is inside,
   * or after a tap on it on a touch screen. Buttons from the `actions`
   * slot follow along. Defaults to `'hover'`.
   */
  actionsVisible?: ChatMessageActionsVisible
  /** Show a copy button among the actions, copying the text parts. */
  copyable?: boolean
  /** Offer an edit button on the person's own messages; saving emits `edit`. */
  editable?: boolean
  /** How many versions of this message there are, e.g. after regenerating. Two or more show a switcher. */
  versions?: number
  /** Which version is shown, from 1. Bound with `v-model:version`. */
  version?: number
  /**
   * Mark this message with a ring in the primary color that hugs the
   * bubble, e.g. after a search jumped to it. It stays while set and fades
   * once turned off (at once with reduced motion): turn it off after a
   * moment. Pair it with ChatList's `scrollToMessage`.
   */
  highlighted?: boolean
  /**
   * The reactions under the message, each with how many reacted and
   * whether the person did; one entry per emoji. Pressing one emits `react`; the app adds or
   * takes back the person's reaction itself.
   */
  reactions?: ChatMessageReaction[]
}

export interface ChatMessageEmits {
  'update:version': [version: number]
  /** An edited message was saved, with its new text. */
  edit: [text: string]
  /** A confirmation part was answered. */
  confirm: [part: ChatConfirmPart, decision: ChatConfirmDecision]
  /** An artifact part was pressed. */
  artifact: [part: ChatArtifactPart]
  /** An option of a question part was pressed, with its `value` and the option itself. */
  question: [part: ChatQuestionPart, value: string | number, option: ChatQuestionOption]
  /**
   * A reaction was pressed, or picked in the `reaction-picker` slot: add
   * the person's reaction, or take it back if `reacted` was on. `reaction`
   * is the entry of `reactions` with that emoji, if there is one.
   */
  react: [emoji: string, reaction: ChatMessageReaction | undefined]
}

export interface ChatMessageSlots {
  /**
   * Renders a text part by hand, in place of plain text or `markdown`.
   * `text` is what has been revealed so far; `part.text` is all of it.
   * `sources` are the message's sources, for citations.
   */
  text?: (props: {
    part: ChatTextPart
    text: string
    index: number
    sources: ChatSource[]
  }) => unknown
  /** Renders parts of a type the message does not know. */
  part?: (props: { part: ChatCustomPart; index: number }) => unknown
  /** Buttons after the built-in actions, e.g. regenerate or feedback. */
  actions?: () => unknown
  /**
   * Content that follows the last word of the last text part on the same
   * line, e.g. an "edited" mark. Unlike `actions` it always shows, whatever
   * `actionsVisible` is. Without a text part it takes a line after the parts,
   * once `loading` is off.
   */
  trailing?: () => unknown
  /**
   * The panel opened by the add-reaction button, e.g. a row of common
   * emoji. Without it there is no add button. `react(emoji)` emits `react`
   * and closes the panel; `close` closes it without reacting.
   */
  'reaction-picker'?: (props: { react: (emoji: string) => void; close: () => void }) => unknown
  /** Renders the emoji of a reaction, e.g. a custom image for an app's own key. */
  reaction?: (props: { reaction: ChatMessageReaction }) => unknown
  /** Replaces all parts, for a message laid out by hand. */
  default?: () => unknown
}

/**
 * The Markdown component's slots, with a `markdown-` prefix, for text
 * rendered with `markdown`: `markdown-code`, `markdown-container-tip`, ...
 */
export type ChatMessageMarkdownSlots = {
  [K in Exclude<keyof MarkdownSlots, 'trailing'> as `markdown-${K & string}`]: MarkdownSlots[K]
}

/** The text of a message, for copying: its text parts, one paragraph each. */
export function messageText(parts: readonly { type: string; text?: unknown }[]): string {
  return parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('\n\n')
}
