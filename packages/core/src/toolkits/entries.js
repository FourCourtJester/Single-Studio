/**
 * Every file inside a drop, including the ones in folders.
 *
 * `dataTransfer.files` flattens nothing: drop a folder and you get one entry that
 * is not a file and cannot be read, which is why dropping a folder used to appear
 * to do nothing at all. The entries API is the only way to see inside one, and it
 * has to be called synchronously during the drop -- the items are gone by the time
 * an await resolves, so every entry is captured first and walked afterwards.
 *
 * Each file comes back with a `path` relative to what was dropped, so a folder of
 * headshots files itself under that folder's name.
 */
export async function filesFromDrop(dataTransfer) {
  const roots = [...(dataTransfer?.items ?? [])].map((item) => (item.kind === 'file' && item.webkitGetAsEntry ? item.webkitGetAsEntry() : null)).filter(Boolean)

  // No entries API, or a plain file drop: what is already there is all there is.
  if (!roots.length) return [...(dataTransfer?.files ?? [])].map((file) => ({ file, path: file.name }))

  const found = []

  const readFile = (entry) => new Promise((resolve, reject) => entry.file(resolve, reject))

  // A directory reader hands back at most 100 entries a call and signals the end
  // with an empty batch, so it has to be drained rather than read once.
  const readDir = (reader) => new Promise((resolve, reject) => reader.readEntries(resolve, reject))

  const walk = async (entry, prefix) => {
    if (entry.isFile) {
      try {
        found.push({ file: await readFile(entry), path: `${prefix}${entry.name}` })
      } catch {
        // An unreadable file in a folder of a hundred loses itself, not the rest.
      }

      return
    }

    if (!entry.isDirectory) return

    const reader = entry.createReader()

    for (;;) {
      const batch = await readDir(reader).catch(() => [])

      if (!batch.length) return

      for (const child of batch) await walk(child, `${prefix}${entry.name}/`)
    }
  }

  for (const root of roots) await walk(root, '')

  return found
}
