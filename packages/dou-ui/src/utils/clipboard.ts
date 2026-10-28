/** Put text on the clipboard, falling back to a hidden text box where the async API is missing. */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      return await navigator.clipboard.writeText(text)
    } catch {
      // e.g. an insecure origin or a denied permission: try the old way
    }
  }
  const box = document.createElement('textarea')
  box.value = text
  box.setAttribute('readonly', '')
  box.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
  document.body.append(box)
  const selection = document.getSelection()
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  box.select()
  // oxlint-disable-next-line typescript/no-deprecated -- the fallback for when the async API is missing
  const ok = document.execCommand('copy')
  box.remove()
  if (range && selection) {
    selection.removeAllRanges()
    selection.addRange(range)
  }
  if (!ok) throw new Error('[dou-ui] copying to the clipboard failed')
}
