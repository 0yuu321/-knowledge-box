import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const asModule = code => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')
const modelUrl = asModule(await readFile(new URL('../src/model.ts', import.meta.url), 'utf8'))
const model = await import(modelUrl)
const repositorySource = (await readFile(new URL('../src/repository.ts', import.meta.url), 'utf8'))
  .replaceAll("from './model'", `from '${modelUrl}'`)
  .replace("from '@supabase/supabase-js'", `from '${import.meta.resolve('@supabase/supabase-js')}'`)
  .replaceAll('import.meta.env.VITE_SUPABASE_URL', 'undefined')
  .replaceAll('import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY', 'undefined')
const { repository } = await import(asModule(repositorySource))
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }

test('ブラウザー保存：CRUD・再読み込み・復習対象・バックアップ', async () => {
  memory.clear()
  let data = await repository.load()
  assert.equal(data.knowledge.length, 0)
  const owner = data.owner
  const draft = { title: '  propsとは？ ', content: '親から子へ渡すデータ。', tab_id: data.tabs[1].id, is_public: true }
  data = await repository.save(data, draft)
  const id = data.knowledge[0].id
  assert.equal(data.knowledge[0].title, 'propsとは？')
  assert.equal(data.knowledge[0].is_public, false, 'ローカルでは公開を許可しない')
  data = await repository.load()
  assert.equal(data.owner, owner)
  assert.equal(data.knowledge[0].id, id)
  data = await repository.save(data, { ...draft, content: '更新後の答え' }, id)
  assert.equal(data.knowledge.length, 1)
  assert.equal((await repository.load()).knowledge[0].content, '更新後の答え')
  const backup = JSON.stringify(data)
  data = await repository.remove(data, id)
  assert.equal(model.todayItem(data.knowledge), undefined, '削除した知識は復習から除外')
  assert.equal((await repository.load()).knowledge.length, 0)
  data = repository.restore(backup)
  assert.equal(data.knowledge[0].id, id)
  assert.equal((await repository.load()).knowledge.length, 1)
})

test('タブ別名・全角検索・固定・少数タブへのアクセス用の順序', async () => {
  memory.clear()
  let data = await repository.load()
  assert.ok(model.matchesTab(data.tabs[0], 'ＦＥ試験'))
  const result = await repository.addTab(data, 'FE試験')
  assert.equal(result.tab.id, data.tabs[0].id)
  assert.equal(result.data.tabs.length, data.tabs.length)
  const custom = await repository.addTab(data, 'TypeScript')
  data = custom.data
  assert.equal(custom.tab.name, 'TypeScript')
  data = await repository.save(data, { title: '型', content: '型の検査', tab_id: data.tabs[0].id, is_public: false })
  assert.ok(model.matchesKnowledge(data.knowledge[0], data.tabs, 'FE試験'))
  assert.ok(model.matchesKnowledge(data.knowledge[0], data.tabs, '検査'))
  data = await repository.preference(data, custom.tab.id, 'pinned')
  const sorted = model.orderedTabs(data.tabs, data.knowledge, data.preferences)
  assert.equal(sorted[0].id, custom.tab.id)
  assert.equal(sorted.length, data.tabs.length, '少数・0件のタブも配列から落とさない')
  assert.ok((await repository.load()).preferences[0].pinned)
})

test('空入力・破損データ・容量不足・別タブの競合で既存データを保護', async () => {
  memory.clear()
  let data = await repository.load()
  const draft = { title: 'テスト', content: '答え', tab_id: null, is_public: false }
  await assert.rejects(repository.save(data, { ...draft, title: '   ' }))
  data = await repository.save(data, draft)
  const original = memory.get(model.LOCAL_KEY)
  const originalSet = localStorage.setItem
  localStorage.setItem = () => { throw new Error('QuotaExceededError') }
  await assert.rejects(repository.save(data, { ...draft, title: '保存失敗' }), /保存できません/)
  assert.equal(memory.get(model.LOCAL_KEY), original)
  localStorage.setItem = originalSet
  const stale = data
  data = await repository.save(data, { ...draft, title: '別タブの変更' })
  await assert.rejects(repository.save(stale, draft), /別のタブ/)
  assert.equal((await repository.load()).knowledge.length, 2)
  const current = memory.get(model.LOCAL_KEY)
  assert.throws(() => repository.restore('{"version":2}'))
  assert.equal(memory.get(model.LOCAL_KEY), current)
  memory.set(model.LOCAL_KEY, '{broken')
  await assert.rejects(repository.load(), /上書きしていません/)
  assert.equal(memory.get(model.LOCAL_KEY), '{broken')
})

test('今日の1問は同じ日・同じ知識で一定、シャッフルは全件を1回ずつ保持', () => {
  const items = [{ id: 'b' }, { id: 'a' }, { id: 'c' }]
  const day = new Date(2026, 10, 12)
  assert.equal(model.todayItem(items, day).id, model.todayItem([...items].reverse(), day).id)
  assert.deepEqual(model.shuffled(items).map(k => k.id).sort(), ['a', 'b', 'c'])
  assert.deepEqual(items.map(k => k.id), ['b', 'a', 'c'])
})
