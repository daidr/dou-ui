import { withInstall } from '../../utils/install'
import CommentThread from './comment-thread.vue'

export const DouCommentThread = withInstall(CommentThread)
export default DouCommentThread

export * from './comment-thread'
export type CommentThreadInstance = InstanceType<typeof CommentThread>

declare module 'vue' {
  export interface GlobalComponents {
    DouCommentThread: typeof DouCommentThread
  }
}
