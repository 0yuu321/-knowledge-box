export interface Tab {
  id: string
  name: string
  aliases: string[]
}

export interface Knowledge {
  id: string
  owner_id: string
  title: string
  content: string
  tab_id: string | null
  is_public: boolean
  original_author_id: string | null
  source_id: string | null
  created_at: string
  updated_at: string
}

export interface Preference {
  tab_id: string
  favorite: boolean
  pinned: boolean
}

export interface BoxData {
  version: 1
  revision?: number
  owner: string
  knowledge: Knowledge[]
  tabs: Tab[]
  preferences: Preference[]
}

export type Draft = Pick<Knowledge, 'title' | 'content' | 'tab_id' | 'is_public'>
export const LOCAL_KEY = 'knowledge-box.v1'
export const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('ja').replace(/[\s・_ー-]/g, '')
export function matchesTab(tab: Tab, query: string) {
  return [tab.name, ...tab.aliases].some(name => normalize(name).includes(normalize(query)))
}
export function matchesKnowledge(item: Knowledge, tabs: Tab[], query: string) {
  const tab = tabs.find(t => t.id === item.tab_id)
  return normalize(item.title + ' ' + item.content).includes(normalize(query)) || Boolean(tab && matchesTab(tab, query))
}
export function orderedTabs(tabs: Tab[], items: Knowledge[], preferences: Preference[]) {
  return [...tabs].sort((a, b) => {
    const pinned = (id: string) => Number(preferences.find(p => p.tab_id === id)?.pinned ?? false)
    const count = (id: string) => items.filter(k => k.tab_id === id).length
    return pinned(b.id) - pinned(a.id) || count(b.id) - count(a.id) || a.name.localeCompare(b.name, 'ja')
  })
}
export function todayItem(items: Knowledge[], date = new Date()) {
  if (!items.length) return undefined
  const day = Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`)
  return [...items].sort((a, b) => a.id.localeCompare(b.id))[day % items.length]
}
export function shuffled<T>(items: T[]) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
export function validateDraft(draft: Draft) {
  if (!draft.title.trim() || !draft.content.trim()) throw new Error('タイトルと説明・内容を入力してください。')
  if (draft.title.trim().length > 120 || draft.content.trim().length > 10000) throw new Error('タイトルは120文字、説明・内容は10,000文字以内で入力してください。')
}
export function emptyData(): BoxData {
  return {
    version: 1, owner: crypto.randomUUID(), knowledge: [], preferences: [],
    tabs: [
      { id: '11111111-1111-4111-8111-111111111111', name: '基本情報技術者試験', aliases: ['FE', 'FE試験', '基本情報'] },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Web開発', aliases: ['ウェブ開発', 'React', 'フロントエンド'] },
      { id: '33333333-3333-4333-8333-333333333333', name: '英語', aliases: ['English', '英会話'] },
      { id: '44444444-4444-4444-8444-444444444444', name: '暮らしの知恵', aliases: ['生活', '日常'] },
    ],
  }
}
export function parseData(raw: string): BoxData {
  const d = JSON.parse(raw) as BoxData
  if (d.version !== 1 || typeof d.owner !== 'string' || !Array.isArray(d.knowledge) || !Array.isArray(d.tabs) || !Array.isArray(d.preferences)) throw new Error('保存データの形式が異なります。')
  if (d.revision !== undefined && (!Number.isSafeInteger(d.revision) || d.revision < 0)) throw new Error('保存データのリビジョンが不正です。')
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuid.test(d.owner)) throw new Error('保存データの利用者IDが不正です。')
  for (const t of d.tabs) if (!uuid.test(t.id) || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 60 || !Array.isArray(t.aliases) || !t.aliases.every(a => typeof a === 'string')) throw new Error('タブの保存データが不正です。')
  for (const k of d.knowledge) {
    if (!uuid.test(k.id) || k.owner_id !== d.owner || typeof k.title !== 'string' || typeof k.content !== 'string' || typeof k.is_public !== 'boolean' || (k.tab_id !== null && !d.tabs.some(t => t.id === k.tab_id)) || !Number.isFinite(Date.parse(k.created_at)) || !Number.isFinite(Date.parse(k.updated_at))) throw new Error('知識の保存データが不正です。')
    validateDraft(k)
    if ((k.source_id !== null && (typeof k.source_id !== 'string' || !uuid.test(k.source_id))) || (k.original_author_id !== null && (typeof k.original_author_id !== 'string' || !uuid.test(k.original_author_id))) || ((k.source_id === null) !== (k.original_author_id === null))) throw new Error('コピー元の保存データが不正です。')
  }
  for (const p of d.preferences) if (!d.tabs.some(t => t.id === p.tab_id) || typeof p.favorite !== 'boolean' || typeof p.pinned !== 'boolean') throw new Error('タブ設定の保存データが不正です。')
  if (new Set(d.knowledge.map(k => k.id)).size !== d.knowledge.length || new Set(d.tabs.map(t => t.id)).size !== d.tabs.length) throw new Error('保存データに重複したIDがあります。')
  return d
}
