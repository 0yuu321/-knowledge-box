import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { BoxData, Draft, Knowledge } from './model'
import { matchesTab } from './model'

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    box: <><path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7M12 11v10M7 5l10 4"/></>,
    home: <><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></>,
    book: <><path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Z"/><path d="M12 5v15"/></>,
    tabs: <><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M7 6V3h10v3M8 12h8M8 16h5"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/><path d="M20 2v4M18 4h4"/></>,
    heart: <path d="M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-5 5 8 15 8 15S25 10 20 5Z"/>,
    pin: <><path d="m8 3 8 0-1 7 4 4H5l4-4Z"/><path d="M12 14v7"/></>,
    edit: <><path d="m15 4 5 5-10 10-6 1 1-6Z"/><path d="m12 7 5 5"/></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    check: <path d="m4 12 5 5L20 6"/>,
    globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
    refresh: <path d="M20 8a8 8 0 1 0 0 8M20 3v6h-6"/>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.box}</svg>
}

export function Modal({ title, children, onClose, busy = false, className = '' }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { dialog.close(); document.body.style.overflow = old } }, [])
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) onClose() }}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="閉じる" onClick={onClose} disabled={busy}><Icon name="close"/></button></div>{children}</dialog>
}

export function Editor({ data, item, cloud, busy, error, onClose, onSave, onAddTab }: { data: BoxData; item?: Knowledge; cloud: boolean; busy: boolean; error: string; onClose: () => void; onSave: (draft: Draft, id?: string) => Promise<boolean>; onAddTab: (name: string) => Promise<string | undefined> }) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [content, setContent] = useState(item?.content ?? '')
  const [tabId, setTabId] = useState(item?.tab_id ?? '')
  const [query, setQuery] = useState('')
  const [isPublic, setPublic] = useState(item?.is_public ?? false)
  const [tabError, setTabError] = useState('')
  const [creating, setCreating] = useState(false)
  const selected = data.tabs.find(t => t.id === tabId)
  async function createTab() { setTabError(''); setCreating(true); try { const id = await onAddTab(query); if (id) { setTabId(id); setQuery('') } } catch (e) { setTabError(e instanceof Error ? e.message : 'タブを作成できません。') } finally { setCreating(false) } }
  return <Modal title={item ? '知識を編集' : '新しい知識を登録'} onClose={onClose} busy={busy || creating}><p className="muted">今日の「なるほど」を、未来の自分に。</p><form onSubmit={async e => { e.preventDefault(); await onSave({ title, content, tab_id: tabId || null, is_public: isPublic }, item?.id) }}><fieldset disabled={busy || creating}>
    <label className="field">タイトル・復習の問題 <span className="required">必須</span><input autoFocus required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="例：Reactのpropsとは？"/><small>復習では、このタイトルが問題になります。{title.length}/120</small></label>
    <label className="field">説明・答え <span className="required">必須</span><textarea required maxLength={10000} rows={5} value={content} onChange={e => setContent(e.target.value)} placeholder="学んだことを、自分の言葉で書いてみましょう。"/></label>
    <div className="field"><label htmlFor="tab-query">タブ <span className="muted">任意</span></label>{selected && <div className="selected-tab"><span>＃ {selected.name}</span><button type="button" className="text-button" onClick={() => setTabId('')}>解除</button></div>}<input id="tab-query" value={query} maxLength={60} onChange={e => setQuery(e.target.value)} placeholder="タブ名・別名で検索（例：FE試験）"/><div className="tab-suggestions" aria-label="タブ候補">{data.tabs.filter(t => matchesTab(t, query)).slice(0, 8).map(tab => <button className={`chip ${tab.id === tabId ? 'active' : ''}`} key={tab.id} type="button" onClick={() => { setTabId(tab.id); setQuery('') }}>＃ {tab.name}</button>)}</div>{query.trim() && <button type="button" className="text-button" onClick={createTab}><Icon name="plus" size={16}/>「{query.trim()}」でタブを作成・選択</button>}<small>別名が一致する場合は既存タブを選択します。{cloud ? 'タブ名は他の利用者にも表示されます。個人情報は入れないでください。' : '公開・共有はSupabase接続後に利用できます。'}</small>{tabError && <p role="alert" className="error">{tabError}</p>}</div>
    <div className="field"><label htmlFor="visibility">公開設定</label><select id="visibility" disabled={!cloud} value={isPublic ? 'public' : 'private'} onChange={e => setPublic(e.target.value === 'public')}><option value="private">非公開 — 自分だけ</option><option value="public">公開 — ほかの利用者も閲覧できます</option></select><small>{cloud ? '公開したタイトル・内容は他の利用者がコピーして保存できます。' : 'ブラウザー保存モードでは、すべて非公開です。'}</small></div>
    </fieldset>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy || creating}>キャンセル</button><button className="button primary" type="submit" disabled={busy || creating}><Icon name="check" size={18}/>{busy ? '保存中…' : item ? '変更を保存' : '知識を登録'}</button></div></form></Modal>
}

export function Quiz({ items, onClose }: { items: Knowledge[]; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState(false)
  const done = index >= items.length
  return <Modal title="知識の復習" onClose={onClose} className="quiz-modal">{done ? <div className="quiz-finished"><span className="finished-icon"><Icon name="check" size={38}/></span><p className="eyebrow">ONE MILLIMETER FORWARD</p><h3>またひとつ、知識が自分のものに。</h3><p>{items.length}問の復習が完了しました。<br/>小さな積み重ねを、明日も。</p><button className="button primary" onClick={onClose}>知識帳に戻る</button></div> : <><div className="quiz-meta"><span>{index + 1} / {items.length} 問</span><span>思い出すことが、定着の第一歩。</span></div><progress value={index} max={items.length} aria-label="復習の進み具合"/><p className="eyebrow">QUESTION {String(index + 1).padStart(2, '0')}</p><h3 className="quiz-question">{items[index].title}</h3>{answer ? <div className="quiz-answer"><span className="eyebrow">ANSWER</span><p className="preserve">{items[index].content}</p></div> : <button className="reveal" onClick={() => setAnswer(true)}><Icon name="spark"/>タップして答えを確認</button>}<div className="modal-actions"><button className="button secondary" onClick={onClose}>途中で終了</button><button className="button primary" disabled={!answer} onClick={() => { setIndex(index + 1); setAnswer(false) }}>{index + 1 === items.length ? '復習を完了' : '次の問題'}<Icon name="arrow" size={18}/></button></div></>}</Modal>
}

export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <div className="empty"><span className="empty-icon"><Icon name="book" size={28}/></span><h3>{title}</h3><p>{children}</p>{action}</div> }
