# Production Operation Management Solution - 全体デザイン

## 概要
生産調整を行う業務ソリューション。委託先の工場に対して、生産数量の増減を調整する依頼を行い、そのステータスや期限を管理するシステム。

## 業務フロー (Business Flow)

### 1. 生産調整依頼プロセス
```
[計画担当者] → [生産調整依頼作成] → [工場への依頼送信] → [工場からの回答待ち] → [回答受領・承認] → [生産調整実行]
```

#### 1.1 生産調整依頼の作成
- **担当者**: 生産計画担当者
- **トリガー**: 需要予測変更、在庫状況変化、緊急対応要求
- **アクション**:
  - 調整対象製品の選択
  - 調整数量の決定（増産/減産）
  - 返答期限の設定
  - 納期の設定
  - 優先度の設定
  - 工場の選択

#### 1.2 工場への依頼送信
- **システム機能**: 自動通知システム
- **通知方法**: メール、システム内通知
- **含まれる情報**:
  - 製品情報
  - 調整数量
  - 返答期限
  - 納期
  - 優先度
  - 理由・背景

#### 1.3 工場での確認・回答
- **担当者**: 工場生産管理者
- **回答内容**:
  - 受諾/拒否
  - 対応可能数量
  - 対応可能期限
  - 追加コスト
  - コメント

#### 1.4 回答の承認・調整
- **担当者**: 生産計画担当者
- **アクション**:
  - 工場回答の確認
  - 条件調整（必要に応じて）
  - 最終承認または内容変更による再送信
  - 生産指示書発行（承認の場合）

#### 1.5 内容変更による再送信プロセス
- **条件**: 工場からの回答内容が要求と合わない場合
- **アクション**:
  - 依頼内容の修正（数量、期限、条件等）
  - 修正理由の記録
  - 工場への再送信
  - ステータスを「送信済み」に戻す

### 2. ステータス管理プロセス
```
[送信済み] ⇄ [確認中] → [回答済み] → [承認済み] → [完了]
    ↑                             ↘ [拒否]
    └─── 内容変更・再送信 ←────────┘
                      ↘ [キャンセル]
```

**注**: 工場からの回答受領後、内容を変更して再送信する場合は、ステータスが「送信済み」に戻り、プロセスが繰り返されます。

### 3. 期限管理プロセス
- **返答期限**: 工場からの回答期限
- **納期**: 生産調整完了期限
- **アラート機能**: 期限前通知、期限超過警告

## データモデル (Data Model)

### 主要エンティティ

#### 1. 生産調整依頼 (ProductionAdjustmentRequest)
```
- request_id (PK): 依頼ID
- request_date: 依頼日時
- requester_id (FK): 依頼者ID
- factory_id (FK): 対象工場ID
- product_id (FK): 対象製品ID
- adjustment_type: 調整種別 (増産/減産)
- requested_quantity: 依頼数量
- current_quantity: 現在の生産数量
- target_quantity: 目標生産数量
- priority: 優先度 (高/中/低)
- reason: 依頼理由
- response_deadline: 返答期限
- delivery_date: 納期
- required_materials_inventory: 必須素材の在庫
- status: ステータス
- status_memo: 状況メモ
- revision_count: 修正回数
- revision_reason: 修正理由
- created_at: 作成日時
- updated_at: 更新日時
```

#### 2. 工場 (Factory)
```
- factory_id (PK): 工場ID
- factory_name: 工場名
- factory_code: 工場コード
- location: 所在地
- contact_person: 担当者名
- contact_email: 連絡先メール
- contact_phone: 連絡先電話
- production_capacity: 生産能力
- specialities: 専門分野
- status: ステータス (稼働中/停止中)
- created_at: 作成日時
- updated_at: 更新日時
```

#### 3. 製品 (Product)
```
- product_id (PK): 製品ID
- product_name: 製品名
- product_code: 製品コード
- category: カテゴリ
- unit: 単位
- standard_lead_time: 標準リードタイム
- minimum_order_quantity: 最小発注数量
- required_materials: 必須素材
- description: 説明
- status: ステータス (有効/無効)
- created_at: 作成日時
- updated_at: 更新日時
```

#### 4. 工場回答 (FactoryResponse)
```
- response_id (PK): 回答ID
- request_id (FK): 依頼ID
- responder_id (FK): 回答者ID
- response_date: 回答日時
- acceptance_status: 受諾状況 (受諾/拒否/条件付き受諾)
- available_quantity: 対応可能数量
- proposed_deadline: 提案期限
- additional_cost: 追加コスト
- comments: コメント
- created_at: 作成日時
- updated_at: 更新日時
```

#### 5. 担当者 (User)
```
- user_id (PK): ユーザーID
- username: ユーザー名
- email: メールアドレス
- role: 役割 (計画担当者/工場管理者/管理者)
- factory_id (FK): 所属工場ID (工場管理者の場合)
- status: ステータス (有効/無効)
- created_at: 作成日時
- updated_at: 更新日時
```

#### 6. ステータス履歴 (StatusHistory)
```
- history_id (PK): 履歴ID
- request_id (FK): 依頼ID
- previous_status: 変更前ステータス
- new_status: 変更後ステータス
- changed_by (FK): 変更者ID
- change_reason: 変更理由
- changed_at: 変更日時
```

### エンティティ関係図 (ER Diagram)

```
User ||--o{ ProductionAdjustmentRequest : creates
Factory ||--o{ ProductionAdjustmentRequest : receives
Product ||--o{ ProductionAdjustmentRequest : involves
ProductionAdjustmentRequest ||--o{ FactoryResponse : receives
ProductionAdjustmentRequest ||--o{ StatusHistory : tracks
User ||--o{ FactoryResponse : creates
User ||--o{ StatusHistory : creates
Factory ||--o{ User : employs
```

## ステータス定義

### 生産調整依頼ステータス
- **送信済み (SENT)**: 工場に送信済み
- **確認中 (UNDER_REVIEW)**: 工場で確認中
- **回答済み (RESPONDED)**: 工場から回答あり
- **承認済み (APPROVED)**: 依頼が承認済み
- **完了 (COMPLETED)**: 調整完了
- **キャンセル (CANCELLED)**: 依頼キャンセル
- **拒否 (REJECTED)**: 工場から拒否

### 優先度レベル
- **高 (HIGH)**: 緊急対応が必要
- **中 (MEDIUM)**: 通常の優先度
- **低 (LOW)**: 余裕をもって対応可能

## 主要機能要件

### 1. 依頼管理機能
- 生産調整依頼の作成・編集・削除
- 依頼の一覧表示・検索・フィルタリング
- 依頼詳細の表示
- ステータス更新
- 回答受領後の内容変更・再送信機能

### 2. 工場管理機能
- 工場情報の管理
- 工場別依頼状況の確認
- 工場の稼働状況管理

### 3. 通知機能
- 依頼送信時の自動通知
- 期限アラート
- ステータス変更通知
- レポート機能

### 4. レポート・分析機能
- 依頼状況レポート
- 工場別パフォーマンス分析
- 期限遵守率分析
- 調整数量統計

### 5. ユーザー管理機能
- ユーザー登録・認証
- 役割・権限管理
- ログイン履歴管理

## 非機能要件

### 1. パフォーマンス
- レスポンス時間: 3秒以内
- 同時利用ユーザー数: 100ユーザー
- データ保持期間: 3年間

### 2. セキュリティ
- ユーザー認証・認可
- データ暗号化
- アクセスログ記録

### 3. 可用性
- システム稼働率: 99.5%以上
- 定期メンテナンス: 月1回

### 4. 拡張性
- 工場数の増加に対応
- 製品種別の追加に対応
- 機能追加に対応可能なアーキテクチャ