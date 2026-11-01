import {
  CalendarPlusIcon,
  ClipboardListIcon,
  FileTextIcon,
  ReceiptIcon,
  TruckIcon,
  UsersIcon,
} from '@dou-ui/icons'
import type { Component } from 'vue'

// 文档里只保存入口的 id，图标和名字在这里查
export const shortcuts: { id: string; label: string; icon: Component }[] = [
  { id: 'leave', label: '请假', icon: CalendarPlusIcon },
  { id: 'expense', label: '报销', icon: ReceiptIcon },
  { id: 'report', label: '写周报', icon: FileTextIcon },
  { id: 'approval', label: '审批', icon: ClipboardListIcon },
  { id: 'contacts', label: '通讯录', icon: UsersIcon },
  { id: 'shipping', label: '寄快递', icon: TruckIcon },
]
