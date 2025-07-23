#!/bin/bash

# Easy Live Platform Setup Script
# このスクリプトは指定されたドメインでライブ配信プラットフォームをセットアップします

set -e

# 色付きの出力用関数
print_info() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

# ヘルプメッセージ
show_help() {
    echo "Easy Live Platform Setup Script"
    echo ""
    echo "使用方法:"
    echo "  $0 [オプション] [ドメイン名]"
    echo ""
    echo "オプション:"
    echo "  -h, --help                このヘルプメッセージを表示"
    echo "  -s, --ssl                 HTTPS/SSL を有効にする"
    echo "  --clean                   既存のコンテナとボリュームを削除してから開始"
    echo "  --github-id <id>          GitHub Client ID を指定"
    echo "  --github-secret <secret>  GitHub Client Secret を指定"
    echo ""
    echo "例:"
    echo "  $0 localhost                 # localhostで起動"
    echo "  $0 example.com               # example.comで起動"
    echo "  $0 -s live.example.com       # HTTPS有効でlive.example.comで起動"
    echo ""
}

# デフォルト値
DOMAIN="localhost"
PROTOCOL="http"
CLEAN_MODE=false
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""

# コマンドライン引数を解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -s|--ssl)
            PROTOCOL="https"
            shift
            ;;
        --clean)
            CLEAN_MODE=true
            shift
            ;;
        --github-id)
            AUTH_GITHUB_ID="$2"
            shift 2
            ;;
        --github-secret)
            AUTH_GITHUB_SECRET="$2"
            shift 2
            ;;
        -*)
            print_error "不明なオプション: $1"
            show_help
            exit 1
            ;;
        *)
            DOMAIN="$1"
            shift
            ;;
    esac
done

print_info "Easy Live Platform のセットアップを開始します..."
print_info "ドメイン: $DOMAIN"
print_info "プロトコル: $PROTOCOL"

# 必要なコマンドの確認
command -v docker >/dev/null 2>&1 || { print_error "Docker がインストールされていません。"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { print_error "Docker Compose がインストールされていません。"; exit 1; }

# 既存のコンテナを停止・削除
if [ "$CLEAN_MODE" = true ]; then
    print_info "既存のコンテナとボリュームを削除しています..."
    docker-compose down -v --remove-orphans 2>/dev/null || true
fi

# .envファイルの作成
print_info ".env ファイルを作成しています..."

# .env.exampleファイルの存在確認
if [ ! -f ".env.example" ]; then
    print_error ".env.example ファイルが見つかりません。"
    exit 1
fi

# NEXTAUTH_SECRETの生成
print_info "NEXTAUTH_SECRET を生成しています..."
if command -v openssl >/dev/null 2>&1; then
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    print_success "NEXTAUTH_SECRET が生成されました"
else
    print_warning "openssl が見つかりません。デフォルト値を使用します。"
    NEXTAUTH_SECRET="your-nextauth-secret-please-change-this-in-production"
fi

# GitHub OAuth設定の入力
if [ -z "$AUTH_GITHUB_ID" ] || [ -z "$AUTH_GITHUB_SECRET" ]; then
    print_info "GitHub OAuth設定を入力してください。"
    echo "GitHub OAuth Appの作成方法："
    echo "1. https://github.com/settings/applications/new にアクセス"
    echo "2. Authorization callback URL: ${PROTOCOL}://${DOMAIN}/api/auth/callback/github"
    echo ""

    if [ -z "$AUTH_GITHUB_ID" ]; then
        read -p "GitHub Client ID を入力してください: " AUTH_GITHUB_ID
        if [ -z "$AUTH_GITHUB_ID" ]; then
            print_warning "GitHub Client ID が入力されていません。デフォルト値を使用します。"
            AUTH_GITHUB_ID="your-github-client-id"
        fi
    fi

    if [ -z "$AUTH_GITHUB_SECRET" ]; then
        read -s -p "GitHub Client Secret を入力してください: " AUTH_GITHUB_SECRET
        echo ""
        if [ -z "$AUTH_GITHUB_SECRET" ]; then
            print_warning "GitHub Client Secret が入力されていません。デフォルト値を使用します。"
            AUTH_GITHUB_SECRET="your-github-client-secret"
        fi
    fi
else
    print_info "GitHub OAuth設定がコマンドライン引数で指定されました。"
fi

# .env.exampleをベースに.envファイルを作成
cp .env.example .env

# 環境変数を置換（macOSのsedに対応）
sed -i.bak "s|DOMAIN=localhost|DOMAIN=$DOMAIN|g" .env
sed -i.bak "s|PROTOCOL=http|PROTOCOL=$PROTOCOL|g" .env
sed -i.bak "s|NEXTAUTH_SECRET=your-nextauth-secret-please-change-this-in-production|NEXTAUTH_SECRET=$NEXTAUTH_SECRET|g" .env
sed -i.bak "s|AUTH_GITHUB_ID=your-github-client-id|AUTH_GITHUB_ID=$AUTH_GITHUB_ID|g" .env
sed -i.bak "s|AUTH_GITHUB_SECRET=your-github-client-secret|AUTH_GITHUB_SECRET=$AUTH_GITHUB_SECRET|g" .env

# バックアップファイルを削除
rm -f .env.bak

print_success ".env ファイルが作成されました"

# Dockerイメージのビルド
print_info "Dockerイメージをビルドしています..."
docker-compose build

print_success "Dockerイメージのビルドが完了しました"

# サービスの起動
print_info "サービスを起動しています..."
docker-compose up -d

# サービスの起動確認
print_info "サービスの起動を確認しています..."
sleep 10

# ヘルスチェック
if curl -f "${PROTOCOL}://${DOMAIN}" >/dev/null 2>&1; then
    print_success "セットアップが完了しました！"
    echo ""
    echo "🎉 Easy Live Platform が利用可能です:"
    echo "   Webサイト: ${PROTOCOL}://${DOMAIN}"
    echo "   RTMP配信: rtmp://${DOMAIN}:1935/live"
    echo "   RTMP統計: ${PROTOCOL}://${DOMAIN}:8080/stat"
    echo "   HLSストリーム: ${PROTOCOL}://${DOMAIN}/hls/"
    echo ""
    echo "📋 管理コマンド:"
    echo "   ログを確認: docker-compose logs -f"
    echo "   停止: docker-compose down"
    echo "   再起動: docker-compose restart"
    echo ""
else
    print_warning "サービスは起動しましたが、ヘルスチェックに失敗しました。"
    print_info "数分待ってから ${PROTOCOL}://${DOMAIN} にアクセスしてください。"
    print_info "ログを確認: docker-compose logs -f"
fi
