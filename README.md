# 太陽光・蓄電池ニュース

太陽光発電と系統用蓄電池のニュース・プレスリリースを毎日自動で集め、一覧で表示するサイトです。
GitHub だけで動き、費用はかかりません。

## 設置手順（初回のみ・約15〜30分）

1. **GitHubアカウントを作成**（お持ちでなければ https://github.com ）
2. **新しいリポジトリを作成**：右上「+」→「New repository」。名前は例として `energy-news`、**Public** を選んで作成
3. **ファイルをアップロード**：リポジトリ画面の「uploading an existing file」から、このZIPを展開した中身をすべてドラッグ＆ドロップ →「Commit changes」
   - `.github` フォルダは隠しフォルダなので、Macは Finder で `Command + Shift + .` を押すと表示されます
   - うまく上がらない場合は「Add file」→「Create new file」で、名前を `.github/workflows/update.yml` にして中身を貼り付けてください
4. **書き込み権限を許可**：Settings → Actions → General →「Workflow permissions」で **Read and write permissions** を選び Save
5. **GitHub Pagesを有効化**：Settings → Pages →「Source: Deploy from a branch」、Branch を **main / docs** にして Save
6. **初回の収集を実行**：Actions タブ →「ニュース更新」→「Run workflow」
7. 1〜2分後、`https://<ユーザー名>.github.io/energy-news/` にアクセス

以降は毎日 6:00 と 18:00（日本時間）に自動で更新されます。

## カスタマイズ

- **収集元・キーワードの変更**：`config.json` を編集
  - `keywords`：記事を「太陽光」「蓄電池」に振り分ける語句
  - `solar_topics`：太陽光記事の細分類と判定語句。上から順に判定し、最初に当たった分類を1つ付けます（どれにも当たらなければ「その他」）
  - `exclude_patterns`：タイトルがこの正規表現に一致する記事は取り込みません（PR TIMESのタグ一覧ページなど）
  - `exclude_sources`：取り込まない配信元名（例：`YouTube`）
  - `feeds`：RSSの一覧。`require_keyword: true` のフィードは、キーワードを含む記事だけを取り込みます
  - Googleニュースの検索語を足すときは `q=` の後ろを差し替えます（日本語はURLエンコード）
- **更新時刻の変更**：`.github/workflows/update.yml` の `cron`（UTC表記。日本時間 −9時間）
- **保存期間**：`config.json` の `keep_days`（初期値90日）

## 補足

- 記事本文は保存せず、タイトルとリンクのみを表示します
- 取得に失敗したフィードは飛ばして処理を続けます（Actionsのログに表示）
- 60日間リポジトリに動きがないと GitHub が定期実行を止めることがあります。その場合は Actions タブで再度有効化してください
