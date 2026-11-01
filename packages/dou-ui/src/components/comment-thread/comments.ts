/** Who wrote a comment. Kept with every comment, so a thread reads on its own. */
export interface CommentAuthor {
  id: string
  name: string
  /** The avatar's image URL. Without one the avatar shows the initials. */
  avatar?: string
}

/** One comment of a thread. */
export interface CommentItem {
  id: string
  author: CommentAuthor
  /** Plain text; line breaks are kept. */
  body: string
  /** When it was written, an ISO date string. */
  createdAt: string
  /** When it was last changed, an ISO date string. */
  editedAt?: string
}

/** A discussion: the comment that started it, then the replies. */
export interface CommentThread {
  id: string
  comments: CommentItem[]
  /** Set once someone marks the discussion as settled. */
  resolved?: { by: CommentAuthor; at: string }
}

/**
 * One change to the comments. Every change the comment components make is
 * one of these, so an app can send it to its server as it is, and apply
 * it on the other side with `applyCommentAction`.
 */
export type CommentAction =
  | { type: 'create'; thread: CommentThread }
  | { type: 'reply'; threadId: string; comment: CommentItem }
  | { type: 'edit'; threadId: string; commentId: string; body: string; editedAt: string }
  /** Deletes a reply. The first comment isn't deleted on its own: the thread goes with it, by `remove`. */
  | { type: 'delete'; threadId: string; commentId: string }
  | { type: 'resolve'; threadId: string; by: CommentAuthor; at: string }
  | { type: 'reopen'; threadId: string }
  | { type: 'remove'; threadId: string }

/** A random id; UUIDs keep comments written at the same time on two devices apart. */
export function createCommentId(): string {
  const crypto = globalThis.crypto
  if (crypto?.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

const startsThread = (
  threads: readonly CommentThread[],
  action: { threadId: string; commentId: string },
) => threads.find((thread) => thread.id === action.threadId)?.comments[0]?.id === action.commentId

/** The threads after `action`, as a new array; the threads it doesn't touch are kept as they are. */
export function applyCommentAction(
  threads: readonly CommentThread[],
  action: CommentAction,
): CommentThread[] {
  if (action.type === 'create')
    return [...threads.filter((thread) => thread.id !== action.thread.id), action.thread]
  if (action.type === 'remove') return threads.filter((thread) => thread.id !== action.threadId)
  if (action.type === 'delete' && startsThread(threads, action)) return [...threads]
  return threads.map((thread) => {
    if (thread.id !== action.threadId) return thread
    switch (action.type) {
      case 'reply':
        return { ...thread, comments: [...thread.comments, action.comment] }
      case 'edit':
        return {
          ...thread,
          comments: thread.comments.map((comment) =>
            comment.id === action.commentId
              ? { ...comment, body: action.body, editedAt: action.editedAt }
              : comment,
          ),
        }
      case 'delete':
        return {
          ...thread,
          comments: thread.comments.filter((comment) => comment.id !== action.commentId),
        }
      case 'resolve':
        return { ...thread, resolved: { by: action.by, at: action.at } }
      case 'reopen': {
        const { resolved: _, ...rest } = thread
        return rest
      }
    }
  })
}

/*
 * Comments in a shared (Yjs) document. Every thread and every comment is
 * one entry of a flat `Y.Map` holding plain values, so two people
 * replying, editing or resolving at once never overwrite each other:
 *
 *   `t:<threadId>`   { first, resolved? }   first: the id of the comment that started it
 *   `c:<commentId>`  { ...comment, thread: threadId }
 *
 * Comments of a thread that is gone are left out when reading.
 */

/** The part of a `Y.Map` the comments use. */
export interface SharedCommentMap {
  get(key: string): unknown
  set(key: string, value: unknown): unknown
  delete(key: string): void
  forEach(callback: (value: unknown, key: string) => void): void
  readonly doc: { transact(run: () => void, origin?: unknown): void } | null
}

interface SharedThread {
  /** The comment that started the thread: first, whatever the clocks said when replies were written. */
  first?: string
  resolved?: CommentThread['resolved']
}

type SharedComment = CommentItem & { thread: string }

const threadKey = (id: string) => `t:${id}`
const commentKey = (id: string) => `c:${id}`

const byTime = (a: CommentItem, b: CommentItem) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1

/** The threads a shared map holds, oldest first. */
export function readSharedComments(map: SharedCommentMap): CommentThread[] {
  const threads = new Map<string, CommentThread>()
  const firsts = new Map<string, string | undefined>()
  const comments: SharedComment[] = []
  map.forEach((value, key) => {
    if (key.startsWith('t:')) {
      const id = key.slice(2)
      const shared = value as SharedThread
      firsts.set(id, shared.first)
      threads.set(
        id,
        shared.resolved ? { id, comments: [], resolved: shared.resolved } : { id, comments: [] },
      )
    } else if (key.startsWith('c:')) comments.push(value as SharedComment)
  })
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts the collected copy
  comments.sort(byTime)
  for (const { thread, ...comment } of comments) {
    const list = threads.get(thread)?.comments
    if (!list) continue
    if (comment.id === firsts.get(thread)) list.unshift(comment)
    else list.push(comment)
  }
  const list = [...threads.values()].filter((thread) => thread.comments.length)
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts the filtered copy
  return list.sort((a, b) => byTime(a.comments[0]!, b.comments[0]!))
}

/** Writes `action` into a shared map, in one Yjs transaction with `origin`. */
export function applySharedCommentAction(
  map: SharedCommentMap,
  action: CommentAction,
  origin?: unknown,
) {
  const run = () => {
    switch (action.type) {
      case 'create': {
        const { id, comments, resolved } = action.thread
        const first = comments[0]?.id
        map.set(threadKey(id), resolved ? { first, resolved } : { first })
        for (const comment of comments) map.set(commentKey(comment.id), { ...comment, thread: id })
        return
      }
      case 'reply':
        if (map.get(threadKey(action.threadId)) === undefined) return
        map.set(commentKey(action.comment.id), { ...action.comment, thread: action.threadId })
        return
      case 'edit': {
        const comment = map.get(commentKey(action.commentId)) as SharedComment | undefined
        if (comment)
          map.set(commentKey(action.commentId), {
            ...comment,
            body: action.body,
            editedAt: action.editedAt,
          })
        return
      }
      case 'delete': {
        const thread = map.get(threadKey(action.threadId)) as SharedThread | undefined
        if (thread?.first !== action.commentId) map.delete(commentKey(action.commentId))
        return
      }
      case 'resolve':
      case 'reopen': {
        const thread = map.get(threadKey(action.threadId)) as SharedThread | undefined
        if (!thread) return
        const { resolved: _, ...rest } = thread
        map.set(
          threadKey(action.threadId),
          action.type === 'resolve'
            ? { ...rest, resolved: { by: action.by, at: action.at } }
            : rest,
        )
        return
      }
      case 'remove': {
        const gone: string[] = [threadKey(action.threadId)]
        map.forEach((value, key) => {
          if (key.startsWith('c:') && (value as SharedComment).thread === action.threadId)
            gone.push(key)
        })
        for (const key of gone) map.delete(key)
      }
    }
  }
  if (map.doc) map.doc.transact(run, origin)
  else run()
}
