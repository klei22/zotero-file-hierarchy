declare const Zotero: any
declare const OS: any

function debug(msg) {
  Zotero.debug(`File hierarchy: ${msg}`)
}

class Collections {
  private path: Record<string, string> = {}
  private saved: Record<string, boolean> = {}

  constructor() {
    let coll

    while (coll = Zotero.nextCollection()) {
      this.register(coll)
    }

    debug('collections: ' + JSON.stringify(this.path))
  }

  private register(collection, path?: string) {
    const key = (collection.primary ? collection.primary : collection).key
    const children = collection.children || collection.descendents || []
    const collections = children.filter(coll => coll.type === 'collection')
    const name = this.clean(collection.name)

    this.path[key] = path ? OS.Path.join(path, name) : name

    for (collection of collections) {
      this.register(collection, this.path[key])
    }
  }

  clean(filename) {
    return filename.replace(/[\x00-\x1F\x7F\/\\:*?"<>|$%]/g, encodeURIComponent)
  }

  split(filename) {
    const dot = filename.lastIndexOf('.')
    return (dot < 1 || dot === (filename.length - 1)) ? [ filename, '' ] : [ filename.substring(0, dot), filename.substring(dot) ]
  }

  save(item) {
    const attachments = (item.itemType === 'attachment') ? [ item ] : (item.attachments || [])
    let collections = (item.collections || []).map(key => this.path[key]).filter(coll => coll)
    if (!collections.length) collections = [ '' ] // if the item is not in a collection, save it in the root.

    for (const att of attachments) {
      if (!att.defaultPath) continue

      const [ base, ext ] = this.split(this.clean(att.filename))
      const subdir = att.contentType === 'text/html' ? base : ''

      for (const coll of collections) {
        let path = [ coll, subdir, base ].filter(p => p).reduce((acc, p) => OS.Path.join(acc, p))

        let filename = `${path}${ext}`
        let postfix = 0
        while (this.saved[filename.toLowerCase()]) {
          filename = `${path}_${++postfix}${ext}`
        }
        this.saved[filename.toLowerCase()] = true

        debug(JSON.stringify(filename))
        att.saveFile(filename, true)
        Zotero.write(`${filename}\n`)
      }
    }
  }
}

function doExport() {
  if (!Zotero.getOption('exportFileData')) throw new Error('File Hierarchy needs "Export File Data" to be on')

  const collections = new Collections

  let item
  while ((item = Zotero.nextItem())) {
    collections.save(item)
  }
}
