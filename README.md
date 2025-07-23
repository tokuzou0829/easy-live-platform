# Easy Live Platform
このプラットフォームは会員登録無しで誰でもライブ配信を開始でき、誰でも気軽にチャットに参加してライブを盛り上げることができます。

将来的にこのプラットフォームを誰でも気軽にホストできることを目標にしています。

## 🐳 Dockerを使用したセットアップ (推奨)

### 必要な環境
- Docker
- Docker Compose
- Make (オプション)

### 🚀 ワンコマンドセットアップ

**最も簡単な方法（推奨）:**
```bash
git clone https://github.com/tokuzou0829/easy-live-platform
cd easy-live-platform
```
```bash
# 完全なセットアップ
make setup DOMAIN=example.com

# SSL有効でセットアップ
make setup-ssl DOMAIN=live.example.com
```

### 🎯 アクセス情報

セットアップ完了後、以下のようにアクセスできます：

- **Webサイト**: http://your-domain.com (またはhttps://your-domain.com)
- **RTMP配信エンドポイント**: rtmp://your-domain.com:1935/live

### 利用可能なコマンド

```bash
make help                           # 利用可能なコマンドを表示
make setup DOMAIN=<domain>         # 完全なセットアップを実行
make setup-ssl DOMAIN=<domain>     # SSL有効でセットアップ
make build                          # すべてのDockerイメージをビルド
make up DOMAIN=<domain>             # すべてのサービスを起動
make down                           # すべてのサービスを停止
make restart                        # すべてのサービスを再起動
make logs                           # すべてのサービスのログを表示
make clean                          # Dockerイメージとボリュームをクリーンアップ
make env-check                      # 環境変数の設定を確認
```

### サービス構成

- **nginx-rtmp**: ライブストリーミング用のNginx + RTMPモジュール
  - ポート: 80 (HTTP), 1935 (RTMP), 8080 (配信ダッシュボード)
- **frontend**: Next.js Webアプリケーション
  - ポート: 3000 (内部)
- **main-backend**: メインAPI
  - ポート: 3001 (内部)
- **chat-backend**: Socket.ioチャットサーバー
  - ポート: 3002 (内部)
- **thumbnail-gen**: サムネイル生成API
  - ポート: 3003 (内部)
### 配信方法

1. Webサイトで配信を作成
2. 表示されるストリームキーを使用してRTMPで配信
   ```bash
   # OBSの場合
   サーバー: rtmp://your-domain.com:1935/live?password=<webサイトで生成されたパスワード>
   ストリームキー: <webサイトで生成されたキー>
   
   # FFmpegの場合
   ffmpeg -i input.mp4 -c copy -f flv rtmp://your-domain.com:1935/live?password=<webサイトで生成されたパスワード>/<ストリームキー>
   ```


### データの永続化

- SQLiteデータベース: `db_data` ボリューム
- HLSファイル: `hls_data` ボリューム

### 🔐 認証設定

#### GitHub OAuth認証
このプラットフォームはGitHub OAuth認証をサポートしています。

**GitHub OAuth Appの作成手順：**
1. [GitHub Developer Settings](https://github.com/settings/applications/new) にアクセス
2. 以下の情報を入力：
   - **Application name**: Easy Live Platform (任意の名前)
   - **Homepage URL**: `http://your-domain.com` (HTTPSの場合は`https://`)
   - **Authorization callback URL**: `http://your-domain.com/api/auth/callback/github`
3. Client IDとClient Secretをコピー
4. セットアップ時に入力するか、コマンドライン引数で指定

**環境変数：**
- `AUTH_GITHUB_ID`: GitHub Client ID
- `AUTH_GITHUB_SECRET`: GitHub Client Secret

### トラブルシューティング

**環境変数の確認**
```bash
make env-check
```

**ログを確認**
```bash
make logs
```

**特定のサービスのログを確認**
```bash
docker-compose logs -f <service-name>
# 例: docker-compose logs -f nginx-rtmp
```

**サービスを再ビルド**
```bash
docker-compose build --no-cache <service-name>
```

**GitHub OAuth認証の問題**
- GitHub OAuth Appの設定を確認
- Callback URLが正しく設定されているかチェック
- `.env`ファイルのGitHub関連設定を確認：
  ```bash
  make env-check
  ```

---