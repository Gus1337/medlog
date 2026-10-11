/**
 * Hands files to the iOS share sheet (Save to Files, AirDrop, Mail…), or
 * downloads them where file sharing isn't supported. Resolves to false if the
 * person cancels the share sheet.
 */
export async function shareFiles(files: File[], title: string): Promise<boolean> {
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title })
      return true
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false
      throw err
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  return true
}
