import type { ChatArtifactKind, ChatArtifactStatus } from '../chat-artifact/chat-artifact'
import type { ChatAttachment } from '../chat-attachments/chat-attachments'
import type {
  ChatConfirmDecision,
  ChatConfirmStatus,
  ChatConfirmTone,
} from '../chat-confirm/chat-confirm'
import type { ChatPlanItem } from '../chat-plan/chat-plan'
import type { ChatSource } from '../chat-sources/chat-sources'
import type { ChatStep } from '../chat-steps/chat-steps'
import type { ChatToolCallStatus } from '../chat-tool-call/chat-tool-call'

/** Who wrote the message. */
export type ChatMessageSender = 'user' | 'assistant' | 'system'

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
}
export interface ChatStepsPart {
  type: 'steps'
  items: ChatStep[]
  running?: boolean
  title?: string
}
export interface ChatPlanPart {
  type: 'plan'
  items: ChatPlanItem[]
  title?: string
  collapsible?: boolean
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

export interface ChatMessageProps {
  sender?: ChatMessageSender
  /**
   * What the message is made of, in order: text, reasoning, tool calls,
   * steps, a plan, sources, files, artifacts and confirmations may follow
   * one another in any order.
   */
  parts?: (ChatMessagePart | ChatCustomPart)[]
  /** Shorthand for a message of one text part. */
  content?: string
  /**
   * Render text parts as Markdown, streaming included. `[1]` in the text
   * becomes a citation of the message's sources parts. Set it for every
   * message in the ConfigProvider's `defaults`.
   */
  markdown?: boolean
  /** No part has arrived yet: show the waiting dots, like ChatBubble's. */
  loading?: boolean
  /** Show a copy button among the actions, copying the text parts. */
  copyable?: boolean
  /** Offer an edit button on the person's own messages; saving emits `edit`. */
  editable?: boolean
  /** How many versions of this message there are, e.g. after regenerating. Two or more show a switcher. */
  versions?: number
  /** Which version is shown, from 1. Bound with `v-model:version`. */
  version?: number
}

export interface ChatMessageEmits {
  'update:version': [version: number]
  /** An edited message was saved, with its new text. */
  edit: [text: string]
  /** A confirmation part was answered. */
  confirm: [part: ChatConfirmPart, decision: ChatConfirmDecision]
  /** An artifact part was pressed. */
  artifact: [part: ChatArtifactPart]
}

export interface ChatMessageSlots {
  /**
   * Renders a text part, e.g. through a Markdown renderer. `text` is what
   * has been revealed so far.
   */
  text?: (props: { part: ChatTextPart; text: string; index: number }) => unknown
  /** Renders parts of a type the message does not know. */
  part?: (props: { part: ChatCustomPart; index: number }) => unknown
  /** Buttons after the built-in actions, e.g. regenerate or feedback. */
  actions?: () => unknown
  /** Replaces all parts, for a message laid out by hand. */
  default?: () => unknown
}

/** The text of a message, for copying: its text parts, one paragraph each. */
export function messageText(parts: readonly { type: string; text?: unknown }[]): string {
  return parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('\n\n')
}
