import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouUpload, formatFileSize, matchesAccept } from '../../../index'
import type { UploadFile, UploadRequest } from '../../../index'

const file = (name: string, size = 10, type = 'text/plain') =>
  new File(['x'.repeat(size)], name, { type })

function make(props: Record<string, unknown> = {}) {
  const files = ref<UploadFile[]>((props.modelValue as UploadFile[]) ?? [])
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(DouUpload, {
            ...props,
            modelValue: files.value,
            'onUpdate:modelValue': (value: UploadFile[]) => (files.value = value),
          })
      },
    }),
    { attachTo: document.body },
  )
  const upload = () => wrapper.findComponent(DouUpload)
  const pick = async (...picked: File[]) => {
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: picked, configurable: true })
    await input.trigger('change')
    await flush()
  }
  return { wrapper, files, upload, pick }
}

const flush = () => new Promise((done) => setTimeout(done))

describe('upload helpers', () => {
  it('matches accept strings', () => {
    expect(matchesAccept(file('a.PNG', 1, 'image/png'), 'image/*')).toBe(true)
    expect(matchesAccept(file('a.pdf', 1, 'application/pdf'), '.pdf,.doc')).toBe(true)
    expect(matchesAccept(file('a.txt'), 'image/*,.pdf')).toBe(false)
    expect(matchesAccept(file('a.txt'), 'text/plain')).toBe(true)
    expect(matchesAccept(file('a.txt'))).toBe(true)
  })

  it('formats sizes', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB')
    expect(formatFileSize(250 * 1024)).toBe('250 KB')
  })
})

describe('DouUpload', () => {
  it('renders a button that opens the picker', async () => {
    const { wrapper } = make()
    const input = wrapper.get('input[type="file"]').element as HTMLInputElement
    const click = vi.spyOn(input, 'click')
    await wrapper.get('button').trigger('click')
    expect(click).toHaveBeenCalled()
    expect(wrapper.get('button').text()).toBe('选择文件')
    wrapper.unmount()
  })

  it('lists picked files as ready without a request', async () => {
    const { wrapper, files, pick } = make({ multiple: true })
    await pick(file('a.txt', 2048), file('b.txt'))
    expect(files.value.map((item) => [item.name, item.status])).toEqual([
      ['a.txt', 'ready'],
      ['b.txt', 'ready'],
    ])
    expect(wrapper.findAll('.dou-upload__file')).toHaveLength(2)
    expect(wrapper.get('.dou-upload__detail').text()).toBe('2 KB')
    wrapper.unmount()
  })

  it('replaces the file without multiple', async () => {
    const { wrapper, files, pick } = make()
    await pick(file('a.txt'))
    await pick(file('b.txt'))
    expect(files.value.map((item) => item.name)).toEqual(['b.txt'])
    wrapper.unmount()
  })

  it('rejects by type and size and stops at maxCount', async () => {
    const { wrapper, files, upload, pick } = make({
      multiple: true,
      accept: '.txt',
      maxSize: 100,
      maxCount: 2,
    })
    await pick(
      file('a.png', 1, 'image/png'),
      file('big.txt', 200),
      file('a.txt'),
      file('b.txt'),
      file('c.txt'),
    )
    expect(
      upload()
        .emitted('reject')!
        .map(([picked, reason]) => [(picked as File).name, reason]),
    ).toEqual([
      ['a.png', 'type'],
      ['big.txt', 'size'],
    ])
    expect((upload().emitted('exceed')![0]![0] as File[]).map((item) => item.name)).toEqual([
      'c.txt',
    ])
    expect(files.value.map((item) => item.name)).toEqual(['a.txt', 'b.txt'])
    wrapper.unmount()
  })

  it('sends files through request and reports progress', async () => {
    const pending: {
      progress: (n: number) => void
      done: (value: unknown) => void
      fail: (e: unknown) => void
    }[] = []
    const request: UploadRequest = ({ onProgress }) =>
      new Promise((done, fail) => pending.push({ progress: onProgress, done, fail }))
    const { wrapper, files, upload, pick } = make({ multiple: true, request })
    await pick(file('a.txt'), file('b.txt'))
    expect(files.value.map((item) => item.status)).toEqual(['uploading', 'uploading'])

    // progress from both files before a render lands on both
    pending[0]!.progress(40)
    pending[1]!.progress(70)
    await nextTick()
    expect(files.value.map((item) => item.percent)).toEqual([40, 70])
    expect(wrapper.findAll('[role="progressbar"]')).toHaveLength(2)
    expect(wrapper.get('.dou-upload__status').text()).toBe('上传中 40%')

    pending[0]!.done({ id: 1 })
    pending[1]!.fail(new Error('500'))
    await flush()
    expect(files.value.map((item) => item.status)).toEqual(['success', 'error'])
    expect(files.value[0]!.response).toEqual({ id: 1 })
    expect(upload().emitted('success')).toHaveLength(1)
    expect(upload().emitted('error')).toHaveLength(1)
    expect(wrapper.findAll('.dou-upload__file')[1]!.text()).toContain('上传失败')

    // retry
    await wrapper.get('[aria-label="重试 b.txt"]').trigger('click')
    expect(files.value[1]!.status).toBe('uploading')
    wrapper.unmount()
  })

  it('waits for submit without autoUpload, and skips files beforeUpload refuses', async () => {
    const request = vi.fn<UploadRequest>(() => Promise.resolve('ok'))
    const { wrapper, files, upload, pick } = make({
      multiple: true,
      request,
      autoUpload: false,
      beforeUpload: (picked: File) => picked.name !== 'skip.txt',
    })
    await pick(file('a.txt'), file('skip.txt'))
    expect(files.value.map((item) => item.name)).toEqual(['a.txt'])
    expect(request).not.toHaveBeenCalled()
    ;(upload().vm as unknown as { submit: () => void }).submit()
    await flush()
    expect(request).toHaveBeenCalledTimes(1)
    expect(files.value[0]!.status).toBe('success')
    wrapper.unmount()
  })

  it('removes a file and aborts its request', async () => {
    let signal!: AbortSignal
    const request: UploadRequest = (options) => {
      signal = options.signal
      return new Promise(() => {})
    }
    const { wrapper, files, upload, pick } = make({ request })
    await pick(file('a.txt'))
    await wrapper.get('[aria-label="移除 a.txt"]').trigger('click')
    expect(signal.aborted).toBe(true)
    expect(files.value).toEqual([])
    expect(upload().emitted('remove')).toHaveLength(1)
    wrapper.unmount()
  })

  it('accepts dropped files on the dropzone', async () => {
    const { wrapper, files } = make({ dropzone: true, hint: '仅支持文本文件' })
    const zone = wrapper.get('[role="button"]')
    expect(zone.attributes('aria-describedby')).toBe(
      wrapper.get('.dou-upload__hint').attributes('id'),
    )
    await zone.trigger('dragenter')
    expect(zone.classes()).toContain('is-dragging')
    await zone.trigger('drop', { dataTransfer: { files: [file('a.txt')] } })
    await flush()
    expect(zone.classes()).not.toContain('is-dragging')
    expect(files.value.map((item) => item.name)).toEqual(['a.txt'])
    wrapper.unmount()
  })
})

const inFolder = (name: string, path: string) => {
  const picked = file(name)
  Object.defineProperty(picked, 'webkitRelativePath', { value: path })
  return picked
}
const fileEntry = (name: string, fullPath: string) => ({
  isFile: true,
  isDirectory: false,
  fullPath,
  file: (done: (value: File) => void) => done(file(name)),
})
const paste = (target: EventTarget, pasted: File[]) => {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { files: pasted } })
  target.dispatchEvent(event)
  return event
}

describe('DouUpload folders and pasting', () => {
  it('picks a whole folder and keeps the paths', async () => {
    const { wrapper, files, pick } = make({ directory: true })
    const input = wrapper.get('input[type="file"]')
    expect(input.attributes('webkitdirectory')).toBe('')
    expect((input.element as HTMLInputElement).multiple).toBe(true)
    await pick(inFolder('a.txt', 'notes/a.txt'), inFolder('b.txt', 'notes/2026/b.txt'))
    expect(files.value.map((item) => item.path)).toEqual(['notes/a.txt', 'notes/2026/b.txt'])
    expect(wrapper.text()).toContain('notes/2026/b.txt')
    wrapper.unmount()
  })

  it('reads dropped folders', async () => {
    const { wrapper, files } = make({ directory: true, dropzone: true })
    let handed = false
    const folder = {
      isFile: false,
      isDirectory: true,
      fullPath: '/docs',
      createReader: () => ({
        readEntries: (done: (value: unknown[]) => void) => {
          done(
            handed
              ? []
              : [fileEntry('a.txt', '/docs/a.txt'), fileEntry('b.txt', '/docs/sub/b.txt')],
          )
          handed = true
        },
      }),
    }
    await wrapper.get('.dou-upload__zone').trigger('drop', {
      dataTransfer: { files: [], items: [{ webkitGetAsEntry: () => folder }] },
    })
    await flush()
    await flush()
    expect(files.value.map((item) => item.path)).toEqual(['docs/a.txt', 'docs/sub/b.txt'])
    wrapper.unmount()
  })

  it('adds pasted files where asked, and leaves pasted text alone', async () => {
    const area = document.createElement('div')
    area.id = 'paste-area'
    document.body.append(area)
    const { wrapper, files } = make({ pasteTarget: '#paste-area', multiple: true })
    expect(paste(area, []).defaultPrevented).toBe(false)
    const event = paste(area, [file('shot.png', 10, 'image/png')])
    expect(event.defaultPrevented).toBe(true)
    await flush()
    expect(files.value.map((item) => item.name)).toEqual(['shot.png'])

    paste(document.body, [file('other.png', 10, 'image/png')])
    await flush()
    expect(files.value).toHaveLength(1)
    wrapper.unmount()
    area.remove()
  })
})
