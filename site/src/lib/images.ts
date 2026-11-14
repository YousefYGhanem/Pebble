// The app's real captures (docs/screens, docs/store), hashed by Vite. Content files name them without .png.
const files = import.meta.glob<string>(['../../../docs/screens/*.png', '../../../docs/store/*.png'], { eager: true, query: '?url', import: 'default' })

const byName = new Map(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace(/\.png$/, ''), url]))

export const image = (name: string) => byName.get(name)
