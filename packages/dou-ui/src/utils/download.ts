/**
 * Saves a file in the browser's downloads, as clicking a download link
 * does. For files made on the page, such as an export.
 */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  // some browsers start the download only after the click has run its course
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
