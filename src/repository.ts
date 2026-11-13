import { createClient } from '@supabase/supabase-js'
import type { BoxData, Draft, Knowledge, Preference, Tab } from './model'
import { emptyData, LOCAL_KEY, normalize, parseData, validateDraft } from './model'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const cloudConfigured = Boolean(url || key)
let configurationError = ''
function configuredClient() {
  if (!url || !key) return null
  if (key.startsWith('sb_secret_')) { configurationError = '秘密キーは使用できません。公開用publishableキーを設定してください。'; return null }
  if (key.startsWith('eyJ')) {
    try { if (JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon') { configurationError = 'anon以外のJWTキーは使用できません。'; return null } }
    catch { configurationError = 'Supabaseの公開用キーの形式を確認してください。'; return null }
  }
  try { return createClient(url, key) }
  catch { configurationError = 'SupabaseのURL・公開用キーの形式を確認してください。'; return null }
}
export const client = configuredClient()
let initialization: Promise<string> | undefined

async function ownerId() {
  if (!client) throw new Error(configurationError || 'SupabaseのURLと公開用キーの両方を設定してください。')
  if (!initialization) initialization = (async () => {
    const { data, error } = await client.auth.getSession()
    if (error) throw error
    if (data.session) return data.session.user.id
    const result = await client.auth.signInAnonymously()
    if (result.error) throw result.error
    return result.data.user!.id
  })().catch(error => { initialization = undefined; throw error })
  return initialization
}

function persist(data: BoxData, replace = false) {
  const previous = localStorage.getItem(LOCAL_KEY)
  if (!replace && previous && (JSON.parse(previous).revision ?? 0) !== (data.revision ?? 0)) throw new Error('別のタブで知識帳が更新されました。入力を控えてからページを再読み込みしてください。変更は上書きしていません。')
  const next = { ...data, revision: (data.revision ?? 0) + 1 }
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)) }
  catch { throw new Error('ブラウザーに保存できません。空き容量やストレージの許可を確認してください。変更は保存されていません。') }
  return next
}

async function allRows(table: string): Promise<unknown[]> {
  const result: unknown[] = []
  for (let start = 0; ; start += 500) {
    const { data, error } = await client!.from(table).select('*').order(table === 'tab_preferences' ? 'tab_id' : 'id').range(start, start + 499)
    if (error) throw error
    result.push(...data)
    if (data.length < 500) return result
  }
}

export const repository = {
  async load(): Promise<BoxData> {
    if (!cloudConfigured) {
      const raw = localStorage.getItem(LOCAL_KEY)
      if (raw) {
        try { return parseData(raw) }
        catch { throw new Error('保存データを読み込めません。データは上書きしていません。ブラウザーのストレージを退避してから確認してください。') }
      }
      return persist(emptyData())
    }
    const owner = await ownerId()
    const [knowledge, tabs, preferences] = await Promise.all([allRows('knowledge'), allRows('tabs'), allRows('tab_preferences')])
    return { version: 1, owner, knowledge: knowledge as Knowledge[], tabs: tabs as Tab[], preferences: preferences as Preference[] }
  },
  async save(data: BoxData, draft: Draft, id?: string) {
    validateDraft(draft)
    const value = { ...draft, title: draft.title.trim(), content: draft.content.trim(), is_public: cloudConfigured && draft.is_public }
    if (id && !data.knowledge.some(k => k.id === id && k.owner_id === data.owner)) throw new Error('自分の知識だけを編集できます。')
    if (!cloudConfigured) {
      const now = new Date().toISOString()
      const items = id ? data.knowledge.map(k => k.id === id ? { ...k, ...value, updated_at: now } : k) : [{ ...value, id: crypto.randomUUID(), owner_id: data.owner, original_author_id: null, source_id: null, created_at: now, updated_at: now }, ...data.knowledge]
      return persist({ ...data, knowledge: items })
    }
    const query = id ? client!.from('knowledge').update(value).eq('id', id).eq('owner_id', data.owner) : client!.from('knowledge').insert({ ...value, owner_id: data.owner })
    const { data: saved, error } = await query.select().single()
    if (error) throw error
    return { ...data, knowledge: [saved as Knowledge, ...data.knowledge.filter(k => k.id !== id)] }
  },
  async remove(data: BoxData, id: string) {
    if (!data.knowledge.some(k => k.id === id && k.owner_id === data.owner)) throw new Error('自分の知識だけを削除できます。')
    if (cloudConfigured) {
      const { data: deleted, error } = await client!.from('knowledge').delete().eq('id', id).eq('owner_id', data.owner).select('id').single()
      if (error || !deleted) throw error ?? new Error('削除できませんでした。')
    }
    const next = { ...data, knowledge: data.knowledge.filter(k => k.id !== id) }
    return cloudConfigured ? next : persist(next)
  },
  async addTab(data: BoxData, name: string) {
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 60) throw new Error('タブ名は1〜60文字で入力してください。')
    const existing = data.tabs.find(t => [t.name, ...t.aliases].some(n => normalize(n) === normalize(trimmed)))
    if (existing) return { data, tab: existing }
    let tab: Tab = { id: crypto.randomUUID(), name: trimmed, aliases: [] }
    if (cloudConfigured) {
      const { data: saved, error } = await client!.from('tabs').insert({ name: trimmed, owner_id: data.owner }).select('id,name,aliases').single()
      if (error) {
        if (error.code === '23505') {
          const refreshed = await this.load()
          const found = refreshed.tabs.find(t => normalize(t.name) === normalize(trimmed))
          if (found) return { data: refreshed, tab: found }
        }
        throw error
      }
      tab = saved as Tab
    }
    const next = { ...data, tabs: [...data.tabs, tab] }
    return { data: cloudConfigured ? next : persist(next), tab }
  },
  async preference(data: BoxData, tabId: string, field: 'pinned' | 'favorite') {
    const old = data.preferences.find(p => p.tab_id === tabId) ?? { tab_id: tabId, pinned: false, favorite: false }
    const pref = { ...old, [field]: !old[field] }
    if (cloudConfigured) {
      const { error } = await client!.from('tab_preferences').upsert({ owner_id: data.owner, ...pref }, { onConflict: 'owner_id,tab_id' })
      if (error) throw error
    }
    const next = { ...data, preferences: [...data.preferences.filter(p => p.tab_id !== tabId), pref] }
    return cloudConfigured ? next : persist(next)
  },
  async copy(data: BoxData, source: Knowledge) {
    if (!cloudConfigured) throw new Error('共有機能にはSupabase接続が必要です。')
    if (data.knowledge.some(k => k.owner_id === data.owner && k.source_id === source.id)) throw new Error('この知識はすでに知識帳に保存されています。')
    const { data: original, error: readError } = await client!.from('knowledge').select('*').eq('id', source.id).eq('is_public', true).single()
    if (readError) throw new Error('公開が取り消されたか、元の知識が削除されました。再読み込みしてください。')
    const { data: saved, error } = await client!.from('knowledge').insert({ owner_id: data.owner, title: original.title, content: original.content, tab_id: original.tab_id, is_public: false, source_id: original.id, original_author_id: original.original_author_id ?? original.owner_id }).select().single()
    if (error) throw error
    return { ...data, knowledge: [saved as Knowledge, ...data.knowledge] }
  },
  restore(raw: string) {
    if (cloudConfigured) throw new Error('バックアップの復元はブラウザー保存モード専用です。')
    const data = parseData(raw)
    return persist({ ...data, knowledge: data.knowledge.map(k => ({ ...k, is_public: false })) }, true)
  },
}

export function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : '操作に失敗しました。'
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return '通信できません。接続を確認してください。入力内容はこの画面に残っています。'
  return message
}
