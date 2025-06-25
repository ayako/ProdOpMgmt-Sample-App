# Production Operation Management Solution

## 概要
Azure サービスを活用した生産調整依頼管理システム。工場との生産数量調整をデジタル化し、自動化エージェントによる効率的な業務プロセスを実現します。

## 実装されたシステム構成

### Azure サービス
- **ユーザーUI**: Azure App Service Web App (Linux, Node.js)
- **エージェント**: Azure Functions (JavaScript)
- **生成AI**: Azure OpenAI Services (GPT-4)
- **データベース**: Azure SQL Server / Azure CosmosDB

### アーキテクチャ概要
```
[ユーザー] ←→ [Web アプリ (Node.js)] ←→ [Azure Functions]
                     ↓                      ↓
             [Azure SQL/CosmosDB] ←→ [Azure OpenAI]
```

## 主要機能

### 1. 生産調整依頼管理
- 依頼の作成・編集・削除
- ステータス管理（送信済み→確認中→回答済み→承認済み→完了）
- 期限管理と自動通知

### 2. 工場管理
- 工場マスタ情報の管理
- 生産能力と専門分野の管理
- 工場別の依頼履歴

### 3. 自動化エージェント
- **調整エージェント**: 全体ワークフローの統括
- **工場選定エージェント**: 最適な工場の自動選出
- **応答処理エージェント**: AI による工場回答の自動解析
- **ステータス管理エージェント**: 自動ステータス更新

### 4. AI機能
- 工場からの回答メールの自動解析
- 構造化データ抽出
- 信頼度評価とフォールバック処理

## ワークフロー

### 1. 生産調整依頼プロセス
```
[計画担当者] → [依頼作成] → [工場選定(AI)] → [工場通知] → [回答処理(AI)] → [承認] → [完了]
```

### 2. ステータス管理プロセス
```
送信済み → 確認中 → 回答済み → 承認済み → 完了
           ↓         ↓
         期限切れ   拒否
```

## ファイル構成

```
POMSolution/
├── src/                          # Node.js Web アプリケーション
│   ├── app.js                   # メインアプリケーション
│   ├── models/                  # データモデル
│   │   ├── ProductionRequest.js # 生産調整依頼
│   │   ├── Factory.js          # 工場
│   │   └── StatusHistory.js    # ステータス履歴
│   ├── routes/                 # API ルート
│   │   ├── requests.js         # 依頼管理 API
│   │   ├── factories.js        # 工場管理 API
│   │   ├── products.js         # 製品管理 API
│   │   └── users.js            # ユーザー管理 API
│   └── services/               # サービス層
│       ├── database.js         # DB 抽象化レイヤー
│       └── ai.js              # Azure OpenAI 統合
├── functions/                  # Azure Functions
│   ├── coordination-agent/     # 調整エージェント
│   ├── factory-selection-agent/ # 工場選定エージェント
│   ├── response-processing-agent/ # 応答処理エージェント
│   ├── status-management-agent/ # ステータス管理エージェント
│   └── shared/                 # 共通ライブラリ
├── public/                     # フロントエンド
│   ├── index.html             # メイン UI
│   ├── css/style.css          # スタイルシート
│   └── js/app.js              # フロントエンド JavaScript
├── database/                   # データベースとサンプルデータ
│   ├── schema.sql             # SQL スキーマ
│   ├── users.csv              # ユーザーマスタ
│   ├── factories.csv          # 工場マスタ
│   ├── products.csv           # 製品マスタ
│   └── ...                    # その他 CSV ファイル
├── deployment/                 # デプロイメント設定
│   └── azure-setup.md         # Azure 設定手順
├── scripts/                    # ユーティリティスクリプト
│   └── init-database.js       # DB 初期化
├── test/                       # テスト
│   ├── app.test.js            # アプリケーションテスト
│   └── setup.js               # テスト設定
└── doc/                        # ドキュメント
    ├── solution.md            # 詳細設計書
    ├── agent-architecture.md  # エージェント設計書
    ├── ui-design.md          # UI 設計書
    └── readme_old.md         # 旧 README
```

## セットアップと起動

### 1. 環境設定
```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .env ファイルを編集して Azure サービスの接続情報を設定
```

### 2. データベース初期化
```bash
# サンプルデータでデータベースを初期化
npm run init-db
```

### 3. アプリケーション起動
```bash
# 開発モード
npm run dev

# 本番モード
npm start
```

### 4. テスト実行
```bash
npm test
```

## API エンドポイント

### 生産調整依頼
- `GET /api/requests` - 依頼一覧取得
- `POST /api/requests` - 新規依頼作成
- `PUT /api/requests/:id` - 依頼更新
- `POST /api/requests/:id/process-response` - AI による回答処理

### 工場管理
- `GET /api/factories` - 工場一覧取得
- `POST /api/factories` - 工場新規作成
- `PUT /api/factories/:id` - 工場情報更新

### その他
- `GET /health` - ヘルスチェック
- `GET /api/users` - ユーザー一覧
- `GET /api/products` - 製品一覧

## 環境変数設定

### 必須設定
```bash
# データベース (Azure SQL Server)
DB_SERVER=your-azure-sql-server.database.windows.net
DB_NAME=production_management
DB_USER=your-username
DB_PASSWORD=your-password

# または Azure CosmosDB
COSMOS_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/
COSMOS_KEY=your-cosmos-key

# Azure OpenAI
OPENAI_ENDPOINT=https://your-openai-service.openai.azure.com/
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL_NAME=gpt-4

# Azure Functions
FUNCTIONS_ENDPOINT=https://your-functions-app.azurewebsites.net
FUNCTIONS_KEY=your-functions-key
```

## 特徴

### 1. 環境対応
- Azure SQL Server と Azure CosmosDB の両方をサポート
- 環境変数による設定管理
- 開発・テスト・本番環境での動作確認済み

### 2. 高可用性設計
- データベース接続エラー時の graceful degradation
- AI サービス利用不可時のフォールバック処理
- 自動リトライとエラーハンドリング

### 3. セキュリティ
- ヘルメット (Helmet) によるセキュリティヘッダー
- レート制限機能
- CORS 対応
- 環境変数による機密情報管理

### 4. 監視・ログ
- 構造化ログ出力
- ヘルスチェックエンドポイント
- エラー追跡機能

## デプロイメント

詳細な Azure デプロイ手順は `deployment/azure-setup.md` を参照してください。

## 今後の拡張

- Microsoft Teams 統合
- メール送受信機能
- 高度な分析・レポート機能
- モバイル対応
- 多言語対応

---

詳細な設計仕様については、以下のドキュメントを参照してください：
- [システム設計書](doc/solution.md)
- [UI設計書](doc/ui-design.md)
- [自動化エージェント設計書](doc/agent-architecture.md)
- [Azure デプロイメント手順](deployment/azure-setup.md)