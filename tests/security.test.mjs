import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('RLSと出典保護：2ユーザーの非公開隔離・コピー・改ざん拒否', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    `)
    const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
    await db.exec(schema)
    await db.exec(schema) // 新規プロジェクトでの再実行にも対応
    const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    async function user(id) { await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`) }
    async function create(owner, title, published) {
      return (await db.query('insert into public.knowledge(owner_id,title,content,is_public) values($1,$2,$3,$4) returning *', [owner, title, title + 'の答え', published])).rows[0]
    }
    await user(a)
    const privateA = await create(a, 'Aだけの秘密', false)
    const publicA = await create(a, 'Aの公開知識', true)
    assert.equal((await db.query('select * from knowledge')).rows.length, 2)
    await user(b)
    assert.equal((await db.query('select * from knowledge where id=$1', [privateA.id])).rows.length, 0)
    assert.equal((await db.query('select * from knowledge')).rows.length, 1)
    assert.equal((await db.query('update knowledge set content=$1 where id=$2 returning *', ['改ざん', publicA.id])).rows.length, 0)
    assert.equal((await db.query('delete from knowledge where id=$1 returning *', [publicA.id])).rows.length, 0)
    await assert.rejects(create(a, '所有者偽装', false), /row-level security/)
    await assert.rejects(db.query('insert into knowledge(owner_id,title,content,source_id) values($1,$2,$3,$4)', [b, '不正コピー', '答え', privateA.id]), /コピー元/)
    const copy = (await db.query('insert into knowledge(owner_id,title,content,source_id,original_author_id,is_public) values($1,$2,$3,$4,$5,true) returning *', [b, '偽タイトル', '偽内容', publicA.id, b])).rows[0]
    assert.equal(copy.title, publicA.title)
    assert.equal(copy.content, publicA.content)
    assert.equal(copy.is_public, false)
    assert.equal(copy.original_author_id, a)
    assert.equal(copy.source_id, publicA.id)
    await db.query('update knowledge set content=$1 where id=$2', ['自分用に編集', copy.id])
    await assert.rejects(db.query('update knowledge set owner_id=$1 where id=$2', [a, copy.id]), /permission denied/)
    await assert.rejects(db.query('update knowledge set source_id=null where id=$1', [copy.id]), /permission denied/)
    await assert.rejects(db.query('insert into knowledge(owner_id,title,content,source_id) values($1,$2,$3,$4)', [b, '重複', '答え', publicA.id]), /duplicate key/)
    const tab = (await db.query('select id from tabs limit 1')).rows[0].id
    await db.query('insert into tab_preferences(owner_id,tab_id,pinned,favorite) values($1,$2,true,true)', [b, tab])
    await user(a)
    assert.equal((await db.query('select * from tab_preferences')).rows.length, 0)
    assert.equal((await db.query('select * from knowledge where id=$1', [copy.id])).rows.length, 0)
    assert.equal((await db.query('select content from knowledge where id=$1', [publicA.id])).rows[0].content, publicA.content)
    await db.query('delete from knowledge where id=$1', [publicA.id])
    await user(b)
    assert.equal((await db.query('select content from knowledge where id=$1', [copy.id])).rows[0].content, '自分用に編集', '元の投稿が削除されてもコピーは独立して残る')
    await db.query('delete from knowledge where id=$1', [copy.id])
    assert.equal((await db.query('select * from knowledge')).rows.length, 0)
    await db.exec('reset role; set role anon;')
    await assert.rejects(db.query('select * from knowledge'), /permission denied/)
    await assert.rejects(db.query('select * from tabs'), /permission denied/)
  } finally { await db.close() }
})
