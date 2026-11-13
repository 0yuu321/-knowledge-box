# 知識BOX

知っただけで終わらせない。学びを記録・整理し、1問ずつ思い出すことで「1ミリ良くする」学習アプリです。
React + TypeScript + Vite + CSS。スマートフォン・PCに対応しています。

## 今すぐ使う

```powershell
npm.cmd install
npm.cmd run dev
```

表示されたURLを開きます（通常 http://localhost:5173/ ）。停止は同じターミナルで Ctrl+C。
PowerShellではnpm.ps1の実行制限を避けるためnpm.cmdを使います。
**dist/index.htmlを直接開かず、サーバーのURLにアクセスしてください。編集するのはsrc内のファイルです。distはビルド生成物です。**

## 保存モードと実装状況

| 機能 | ブラウザー保存（設定不要） | Supabase設定後 |
| --- | --- | --- |
| 登録・編集・削除 | 利用可能 | 利用可能 |
| 再読み込み後の保存 | localStorage | データベース |
| タブ整理・固定・件数順・もっと見る | 利用可能 | 利用可能 |
| 別名検索（FE試験→基本情報技術者試験） | 利用可能 | 利用可能 |
| 全体・タブ別のクイズ、答え、次へ、終了 | 利用可能 | 利用可能 |
| 今日の1問・知識検索 | 利用可能 | 利用可能 |
| 公開設定・公開知識・今日の発見 | 利用不可と明示 | 接続用コード実装済み、実サービスでの検証が必要 |
| 共有タブお気に入り・マイタブ | 利用不可と明示 | 接続用コード実装済み、実サービスでの検証が必要 |
| 他人の知識を非公開コピーとして保存 | 利用不可と明示 | 接続用コード実装済み、実サービスでの検証が必要 |
| JSONバックアップ | 書き出し・復元 | 書き出しのみ |

未対応：通常ログイン・端末間のアカウント引き継ぎ・画像添付・高度なAI同義語判定・リアルタイム同期・ローカルからクラウドへの自動移行・通報や管理画面。
公開知識の更新はマイタブの「更新」か再読み込みで反映します。タブ名は共有、知識内容は公開設定に従います。

## 使い方

1. 「＋ 知識を登録」で、タイトル（復習の問題）と説明（答え）を入力します。
2. タブは任意。候補から選択、検索、または新規作成できます。タイトル120文字、説明10,000文字、タブ名60文字まで。
3. 「知識帳」でタブ別に確認。ピンで固定すると先頭に表示されます。それ以外は知識の多い順です。7件以上のタブは「もっと見る」で表示できます。
4. 鉛筆ボタンで編集、ごみ箱ボタンで削除します。削除前に確認があります。削除は取り消せません。
5. 「すべて」または特定タブで「復習する」。答えを確認して「次の問題」、最後に完了画面が出ます。途中終了もできます。
6. ホームの「今日の1問」は自分の知識帳から日付に応じて選びます。
7. 検索欄ではタイトル・内容・タブ名・別名を検索できます。
8. 「使い方・データ保存について」からバックアップできます。ローカル版の復元は現在の保存データを置き換えます。先にバックアップしてください。

### 保存に関する注意

- ブラウザー保存は、端末・ブラウザー・オリジン（URL）ごとの保存です。ブラウザーのデータ削除などで失われます。
- ローカル版で「公開」を選択することはできません。他ユーザーとの共有は行われません。
- クラウド版も匿名認証です。ブラウザーのデータを消したり別端末を使ったりすると、以前の知識帳へアクセスできなくなる場合があります。
- バックアップには知識と匿名ユーザーIDが含まれます。公開リポジトリやSNSにアップロードしないでください。
- クラウド設定を後から追加しても、ローカル版のデータは自動移行しません。切り替える前にJSONを保存してください。元のlocalStorageは削除しません。
- 保存失敗時はエラーを表示し、入力を残します。クラウド通信失敗時に別の保存先へ勝手に切り替えません。
- 同じ知識帳を複数タブで開いて編集した場合、古い状態からのローカル保存を拒否します。入力内容を控えてから再読み込みしてください。

## Supabaseの設定（本人による操作）

まずローカル版をVercelへ公開して提出可能なURLを確保できます。共有機能を使う場合は次を行います。

1. https://supabase.com/dashboard にログインし、新規プロジェクトを作成します。パスワードの入力や料金プランの選択は本人が行います。
2. SQL Editorで **supabase/schema.sql** の全文を新しいクエリへ貼り付け、Runします。このSQLは新規プロジェクト用です。同名テーブルがある別アプリのDBへ適用しないでください。
3. AuthenticationのSign In / Providers設定で **Anonymous Sign-Ins（匿名サインイン）を有効**にします。画面名は変更される場合があります。
4. プロジェクトのConnectダイアログまたはSettings / API KeysからProject URLと**publishable key**を取得します。旧形式ではanonキーを利用できます。
5. ローカル確認用に.env.exampleを **.env.local** という名前でコピーし、次の2項目に値を設定します。

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

6. 開発サーバーを停止して再起動します。URLとキーは両方必要です。設定不備やSQL未適用の場合はエラーを表示します。
7. アプリで「クラウド保存」と表示され、登録→再読み込みで保存されることを確認します。
8. 通常ブラウザーAと別ブラウザーB（またはInPrivate）を使い、下記の共有確認を実施します。

**service_roleキー、sb_secret_キー、DBパスワードをVITE_変数やソースコードに入れないでください。VITE_変数はブラウザーへ配信されます。**
.env.localは.gitignoreで除外しています。publishable/anonキーはRLSを前提にフロントエンドで使う公開用キーです。
匿名認証の公開運用ではSupabaseのレート制限や利用状況を確認してください。CAPTCHAを必須にする場合は、アプリ側にもトークン取得UIの追加が必要です（現状は未実装）。

### RLS・コピーの仕組み

- knowledge：自分の行、または公開行だけSELECT可能。INSERT/UPDATE/DELETEは自分の行のみ。
- tabs：認証済みユーザーに共有するタブ名。作成は本人IDのみ、利用者からの更新・削除は許可しません。
- tab_preferences：お気に入り・固定状態。本人のみ参照・変更可能。
- 認証前のanonロールにはテーブル権限を与えません。匿名認証後はauthenticatedロールです。
- コピーは新しいID・所有者でINSERTし、トリガーで実際の公開元を検証してタイトル・内容・タブ・元の投稿者を取得し、必ず非公開で作成します。
- コピー後の編集は自分のコピーだけに反映。所有者・コピー元・元投稿者の改ざんは権限で拒否します。元が削除されてもコピーと出典IDは残ります。
- 公開を取り消しても、他人が既に保存したコピーは残ります。

### 実サービスでの共有確認

- Aで非公開知識と公開知識を作成。Bには公開だけが表示・検索されること。
- BがAの公開知識を保存。Bの知識帳に非公開コピーができること。
- Bがコピーを編集・削除してもAの投稿が変わらないこと。
- Aの公開取り消し後、Bで更新すると元の公開知識が消えること。Bが保存済みのコピーは残ること。
- Bでタブをお気に入り登録するとマイタブに表示され、再読み込みしても保持されること。

## 検証コマンド

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

- test：Node標準テストと、テスト専用PGlite（PostgreSQL WASM）を使用。ローカル保存CRUD・検索・別名・固定・バックアップ・保存失敗・競合・RLS隔離・コピーの保護を検証。
- build：TypeScriptの厳密な型チェック後、Viteがdistを生成。
- preview：本番ビルドをローカル配信します。表示URLをブラウザーで開きます。
- PGlite上ではSupabaseのauth.users/auth.uidをテスト用に再現しています。実際のSupabase Auth・ネットワーク・PostgRESTとの結合テストを代替するものではありません。

## GitHubへ公開する手順

1. GitHubにログインし、New repositoryでknowledge-boxを作成します。最初はPrivateでも構いません。README/gitignore/licenseの自動作成は選ばず空のリポジトリにします。
2. VS Codeターミナルで次を実行します。すでにgit init済みです。

```powershell
git status
git add .
git diff --cached --stat
git commit -m "Build Knowledge BOX MVP"
git branch -M main
git remote add origin https://github.com/YOUR-USER/knowledge-box.git
git push -u origin main
```

3. 認証画面は本人が操作してください。名前・メールの設定を求められたら、自分の値でgit configを設定します。
4. 公開前に.env.local、node_modules、dist、バックアップJSONが含まれていないことを確認します。バックアップはプロジェクト外に保存してください。
5. コンテストがソースコード公開を求める場合だけ、要項に従いPublicへ変更します。既存リモートがある場合はremote addを繰り返さないでください。

## Vercelへ公開する手順（最優先）

1. https://vercel.com に本人がログインします。
2. Add New → Project → Import Git Repositoryで作成したGitHubリポジトリを選択します。GitHubへのアクセス許可画面は本人が確認します。
3. 設定は以下です。vercel.jsonにも設定しています。

| 項目 | 値 |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | ./（現在のプロジェクト直下） |
| Install Command | npm install（既定） |
| Build Command | npm run build |
| Output Directory | dist |
| Node.js | 22.xなどpackage.jsonのenginesを満たすもの |

4. **先にローカル保存版を公開する場合：環境変数は両方とも未設定にしてDeployします。**
5. Supabase版を公開する場合：Environment VariablesにVITE_SUPABASE_URLとVITE_SUPABASE_PUBLISHABLE_KEYを追加します。Productionに適用してください。
6. Deploy完了後、表示されたProduction URLを開きます。コンテスト提出に使うURLです。
7. 公開URLで登録→編集→復習→再読み込み→削除を確認します。スマートフォンでも確認してください。
8. 後から環境変数を変更した場合は、必ずRedeployします。Viteではビルド時に値が組み込まれます。
9. ログイン不要でアクセスできるProduction URLか、別ブラウザーで確認します。Preview URLの認証制限に注意してください。

GitHub・Vercel・Supabaseのアカウント作成、ログイン、プロジェクト作成、公開は、このコードの作成だけでは完了しません。公開成功は実際のURLで確認してください。

## 提出前チェック（2026年11月13日23:59 日本時間まで）

- [ ] npm.cmd test / npm.cmd run buildが成功する
- [ ] Production URLを別ブラウザーから開ける（Vercelログインを要求されない）
- [ ] 知識を登録・編集・削除できる
- [ ] 再読み込み後も知識が残る
- [ ] 全体・タブ別の復習、答え表示、次へ、途中終了、完了画面が動く
- [ ] 390px前後のスマホ幅で横スクロールや隠れたボタンがない
- [ ] クラウド版なら上記2ユーザーテストを実施
- [ ] ローカル版なら共有未対応と保存方法を応募説明に明記
- [ ] スクリーンショット、作品説明、動作URL、ソースURLなどコンテスト所定の項目を用意
- [ ] 「記録と復習で、知っただけの学びを1ミリ定着へ」を作品説明で伝える
- [ ] 個人情報、秘密キー、他人の著作物、テストデータが公開物に含まれない
- [ ] 締切・応募資格・提出形式はコンテスト公式要項で最終確認

## ファイル構成と学習用メモ

```text
src/
  App.tsx          画面切り替え・ホーム・知識帳・検索・共有画面
  components.tsx   モーダル・登録フォーム・復習クイズ・アイコン
  model.ts         データ型・検索・並び順・検証
  repository.ts    localStorage / Supabaseの保存処理
  main.tsx         Reactの起動
  index.css        PC・スマートフォンのスタイル
supabase/schema.sql テーブル・RLS・コピー元保護トリガー
tests/              保存処理とSQLの自動テスト
public/favicon.svg  アプリアイコン
.env.example        公開用接続情報の設定例
vercel.json         Vercelのビルド設定
```

Reactは画面を部品に分けて表示し、TypeScriptはデータの型をチェック、Viteは開発サーバーと本番用ビルドを担当します。
状態はAppからフォームやクイズへpropsで渡し、repositoryに保存が成功してから画面を更新します。
GitHubへのpush・Vercelへの公開はREADMEの手順で別途行います。

参考：
- https://supabase.com/docs/guides/auth/auth-anonymous
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/environment-variables/managing-environment-variables
