# ダミーデータ説明書

このディレクトリには、Production Operation Management Solutionの主要エンティティのダミーデータが含まれています。

## ファイル構成

### 基本エンティティ
- **users.csv** - 担当者情報（10件）
- **factories.csv** - 工場情報（5件）
- **products.csv** - 製品情報（10件）

### トランザクションエンティティ
- **production_adjustment_requests.csv** - 生産調整依頼（8件）
- **factory_responses.csv** - 工場回答（7件）
- **status_history.csv** - ステータス履歴（23件）

## データの関係性

### ユーザーの役割分担
- **管理者**: システム全体の管理
- **計画担当者**: 生産調整依頼の作成・管理
- **工場管理者**: 各工場での依頼対応・回答

### 工場の専門分野
1. 東京製造工場 - 電子機器・精密機械
2. 大阪生産センター - 自動車部品・金属加工
3. 名古屋工場 - 化学製品・プラスチック
4. 横浜テクノセンター - 半導体・電子部品
5. 福岡製造所 - 食品・医薬品

### ステータスフロー例
```
[送信済み] → [確認中] → [回答済み] → [承認済み] → [完了]
                                  ↘ [拒否]
```

## 使用方法

各CSVファイルは、システムの初期データとして使用できます。
- UTF-8エンコーディング
- カンマ区切り形式
- ヘッダー行付き

## 外部キー関係

- users.factory_id → factories.factory_id
- production_adjustment_requests.requester_id → users.user_id
- production_adjustment_requests.factory_id → factories.factory_id
- production_adjustment_requests.product_id → products.product_id
- factory_responses.request_id → production_adjustment_requests.request_id
- factory_responses.responder_id → users.user_id
- status_history.request_id → production_adjustment_requests.request_id
- status_history.changed_by → users.user_id