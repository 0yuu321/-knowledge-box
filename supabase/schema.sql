-- 知識BOX：新規SupabaseプロジェクトのSQL Editorで実行します。
-- 同名テーブルが既にあるプロジェクトへの適用前には構造を確認してください。
begin;

create table if not exists public.tabs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  aliases text[] not null default '{}',
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists tabs_unique_name on public.tabs (lower(btrim(name)));

create table if not exists public.knowledge (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  tab_id uuid references public.tabs(id),
  is_public boolean not null default false,
  -- 元の投稿・ユーザー削除後も出典IDを記録として残すため、この2列に外部キーを設けない。
  original_author_id uuid,
  source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_provenance check ((source_id is null) = (original_author_id is null))
);
create index if not exists knowledge_owner_idx on public.knowledge(owner_id);
create index if not exists knowledge_public_tab_idx on public.knowledge(tab_id) where is_public;
create unique index if not exists knowledge_unique_copy on public.knowledge(owner_id, source_id) where source_id is not null;

create table if not exists public.tab_preferences (
  owner_id uuid not null references auth.users(id) on delete cascade,
  tab_id uuid not null references public.tabs(id),
  favorite boolean not null default false,
  pinned boolean not null default false,
  primary key (owner_id, tab_id)
);

alter table public.tabs enable row level security;
alter table public.knowledge enable row level security;
alter table public.tab_preferences enable row level security;

-- 匿名「認証」済みのユーザーはauthenticatedロール。
-- anon（認証前）には権限を渡さない。
revoke all on public.tabs, public.knowledge, public.tab_preferences from anon, authenticated;
grant select on public.tabs to authenticated;
grant insert (name, owner_id) on public.tabs to authenticated;
grant select, delete on public.knowledge to authenticated;
grant insert (owner_id,title,content,tab_id,is_public,source_id,original_author_id) on public.knowledge to authenticated;
grant update (title,content,tab_id,is_public) on public.knowledge to authenticated;
grant select, insert, update, delete on public.tab_preferences to authenticated;

drop policy if exists tabs_read on public.tabs;
create policy tabs_read on public.tabs for select to authenticated using (true);
drop policy if exists tabs_create on public.tabs;
create policy tabs_create on public.tabs for insert to authenticated with check ((select auth.uid()) = owner_id);

drop policy if exists knowledge_read on public.knowledge;
create policy knowledge_read on public.knowledge for select to authenticated using (owner_id = (select auth.uid()) or is_public);
drop policy if exists knowledge_create on public.knowledge;
create policy knowledge_create on public.knowledge for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists knowledge_edit on public.knowledge;
create policy knowledge_edit on public.knowledge for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists knowledge_delete on public.knowledge;
create policy knowledge_delete on public.knowledge for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists preferences_owner on public.tab_preferences;
create policy preferences_owner on public.tab_preferences for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- SECURITY INVOKER：コピー元の参照にも呼び出したユーザーのRLSが適用される。
create or replace function public.guard_knowledge() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare source_row public.knowledge%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.source_id is not null then
      select * into source_row from public.knowledge where id = new.source_id and is_public;
      if not found or source_row.owner_id = new.owner_id then
        raise exception 'コピー元の公開知識が見つかりません';
      end if;
      -- クライアントからの出典偽装・公開コピー作成を防ぐ。
      new.original_author_id := coalesce(source_row.original_author_id, source_row.owner_id);
      new.title := source_row.title;
      new.content := source_row.content;
      new.tab_id := source_row.tab_id;
      new.is_public := false;
    elsif new.original_author_id is not null then
      raise exception 'コピー元なしで投稿者IDは指定できません';
    end if;
    new.created_at := now();
  else
    if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id
      or new.source_id is distinct from old.source_id
      or new.original_author_id is distinct from old.original_author_id
      or new.created_at is distinct from old.created_at then
      raise exception '所有者・出典・作成日時は変更できません';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.guard_knowledge() from public, anon, authenticated;
drop trigger if exists knowledge_guard on public.knowledge;
create trigger knowledge_guard before insert or update on public.knowledge for each row execute function public.guard_knowledge();

insert into public.tabs (id,name,aliases) values
('11111111-1111-4111-8111-111111111111','基本情報技術者試験',array['FE','FE試験','基本情報']),
('22222222-2222-4222-8222-222222222222','Web開発',array['ウェブ開発','React','フロントエンド']),
('33333333-3333-4333-8333-333333333333','英語',array['English','英会話']),
('44444444-4444-4444-8444-444444444444','暮らしの知恵',array['生活','日常'])
on conflict do nothing;

commit;
