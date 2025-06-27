# メール状況集約機能 (Email Status Aggregation Feature)

## 概要 (Overview)

この機能は、工場からの生産調整状況をメールで受信し、AIを利用してメール内容を解析し、データベースに状況を更新する機能です。

This feature receives production adjustment status from factories via email, uses AI to analyze email content, and updates status in the database.

## 機能 (Features)

### 1. メール読み取り (Email Reading)
- IMAPプロトコルを使用したメール受信（設定されていない場合はモックデータを使用）
- 未処理メールの自動検出
- 添付ファイルの抽出（将来の機能）

### 2. AI処理 (AI Processing)
- Azure OpenAIを使用したメール内容の解析
- 依頼ID、進捗状況、完了予定日などの構造化データ抽出
- 信頼度スコアによる処理結果の評価

### 3. データベース更新 (Database Updates)
- 抽出された情報のデータベース保存
- 既存の生産調整依頼ステータスの自動更新
- ステータス履歴の記録

### 4. UI表示 (UI Display)
- ダッシュボードでの最新状況表示
- 専用の「状況一覧」セクション
- メール詳細の表示とAI信頼度の確認

## API エンドポイント (API Endpoints)

### GET /api/emails/status-updates
メール由来の状況更新一覧を取得

**レスポンス例:**
```json
[
  {
    "update_id": "ESU1751008435080J497",
    "email_id": "EMAIL_001",
    "request_id": "R-001",
    "status_update": "in_progress",
    "progress_percentage": 80,
    "completion_date": "2024-01-30",
    "email_subject": "Re: 生産調整依頼 R-001 - 進捗報告",
    "email_from": "factory1@example.com",
    "ai_confidence": 0.8,
    "created_at": "2025-06-27T07:13:55.080Z"
  }
]
```

### POST /api/emails/process-emails
未処理メールの一括処理を実行

**レスポンス例:**
```json
{
  "success": true,
  "processed_count": 3,
  "results": [
    {
      "email_id": "EMAIL_001",
      "request_id": "R-001",
      "status_update": { /* EmailStatusUpdate object */ },
      "ai_confidence": 0.8
    }
  ]
}
```

### POST /api/emails/process-single-email
単一メールのテスト処理

**リクエスト:**
```json
{
  "subject": "Re: 生産調整依頼 R-001 - 進捗報告",
  "body": "依頼ID: R-001 について進捗報告いたします。\n\n現在の状況: 生産中\n進捗率: 80%",
  "from": "factory@example.com"
}
```

## 設定 (Configuration)

### 環境変数 (Environment Variables)

```env
# メール設定 (Email Configuration)
EMAIL_HOST=imap.gmail.com
EMAIL_PORT=993
EMAIL_USER=your-email@company.com
EMAIL_PASS=your-app-password

# Azure OpenAI設定 (Azure OpenAI Configuration)
OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
OPENAI_API_KEY=your-api-key
OPENAI_MODEL_NAME=gpt-4o-mini
```

## 使用方法 (Usage)

### 1. ダッシュボードからの実行
1. ダッシュボードにアクセス
2. 「メール処理実行」ボタンをクリック
3. 処理結果を確認

### 2. 状況一覧の確認
1. ナビゲーションから「状況一覧」を選択
2. メール由来の状況更新を一覧表示
3. 「詳細」ボタンで元メール内容を確認

### 3. API経由での実行
```bash
# メール処理の実行
curl -X POST http://localhost:3000/api/emails/process-emails

# 状況更新の取得
curl http://localhost:3000/api/emails/status-updates
```

## データ構造 (Data Structure)

### EmailStatusUpdate モデル
```javascript
{
  update_id: String,           // 更新ID
  email_id: String,            // メールID
  request_id: String,          // 依頼ID
  status_update: String,       // 状況('in_progress', 'completed', 'delayed', 'issue')
  progress_percentage: Number, // 進捗率
  completion_date: String,     // 完了予定日
  issues: String,              // 問題・課題
  additional_info: String,     // 追加情報
  email_subject: String,       // メール件名
  email_body: String,          // メール本文
  email_from: String,          // 送信者
  email_date: Date,            // メール受信日時
  ai_confidence: Number,       // AI信頼度 (0-1)
  processed_at: Date,          // 処理日時
  created_at: Date            // 作成日時
}
```

## テスト (Testing)

```bash
# 全テストの実行
npm test

# 機能別テストの実行
npx jest test/emails.test.js
npx jest test/services.test.js
```

## 今後の拡張予定 (Future Enhancements)

1. **添付ファイル処理**: PDFやExcelファイルからの情報抽出
2. **リアルタイム監視**: WebSocketを使用したリアルタイム状況更新
3. **メール自動返信**: 処理完了時の自動確認メール送信
4. **Microsoft Teams統合**: Teams メッセージからの状況更新
5. **高度なAI分析**: 感情分析や重要度判定