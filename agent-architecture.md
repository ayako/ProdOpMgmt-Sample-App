# 自動化エージェントアーキテクチャ設計書

## 概要

本書は、生産調整プロセスの自動化を実現するためのエージェントアーキテクチャを定義します。メール・Teamsチャットを活用した工場選定・依頼送信の自動化と、工場回答の自動処理・ステータス更新を実現します。

## 自動化対象プロセス

### 1. 工場選定・依頼送信プロセス
- 製品・数量確定後の適切な工場の自動選出
- 選定工場への依頼の自動送信（メール・Teams）

### 2. 回答処理・ステータス更新プロセス  
- 工場からの回答メール・Teamsメッセージの自動読み取り
- 回答内容の構造化データ抽出
- システムステータスの自動更新

## エージェントアーキテクチャ

### システム構成図

```
[生産計画担当者] 
      ↓
[Coordination Agent (調整エージェント)]
      ↓
┌─────────────────┬─────────────────┬─────────────────┐
│ Factory         │ Communication   │ Response        │
│ Selection       │ Agent          │ Processing      │
│ Agent          │                │ Agent          │
└─────────────────┴─────────────────┴─────────────────┘
      ↓                    ↓                    ↓
[Database]      [Email/Teams API]    [Status Management Agent]
```

## エージェント詳細設計

### 1. Coordination Agent (調整エージェント)

**役割**: 全体ワークフローの統括・調整

**機能**:
- 生産調整依頼の受付・初期検証
- **依頼ID（Request ID）の自動生成・付与**
- 各専門エージェントへのタスク分散
- プロセス進行状況の監視・制御
- 例外処理・エラーハンドリング
- 人間オペレーターへのエスカレーション

**入力データ**:
```json
{
  "request_id": "string",
  "product_id": "string", 
  "adjustment_type": "増産|減産",
  "requested_quantity": "number",
  "priority": "高|中|低",
  "response_deadline": "datetime",
  "delivery_date": "datetime",
  "reason": "string"
}
```

**判断ロジック**:
- **依頼ID生成**: 一意な識別子の自動生成（例: REQ-2024-001234）
- 優先度に基づくタスクスケジューリング
- 工場選定結果の妥当性検証
- 送信失敗時の再試行戦略
- 複数工場への分割依頼の判断

### 2. Factory Selection Agent (工場選定エージェント)

**役割**: 製品・条件に最適な工場の自動選定

**選定アルゴリズム**:
```python
def select_factories(product, quantity, deadline, priority):
    # 1. 製品専門分野による絞り込み
    specialized_factories = filter_by_speciality(product.category)
    
    # 2. 生産能力による評価
    capacity_score = evaluate_capacity(factories, quantity)
    
    # 3. 過去実績による信頼度評価
    reliability_score = calculate_reliability(factories, product)
    
    # 4. 地理的優位性の評価
    location_score = evaluate_location(factories, delivery_requirements)
    
    # 5. 総合スコアによるランキング
    total_score = (capacity_score * 0.4 + 
                   reliability_score * 0.3 + 
                   location_score * 0.3)
    
    return rank_factories(total_score)
```

**選定基準**:
- **専門分野適合性**: 製品カテゴリとの一致度
- **生産能力**: 要求数量に対する対応可能性
- **過去実績**: 納期遵守率・品質評価
- **地理的条件**: 配送効率・コスト
- **現在の稼働状況**: リアルタイム負荷状況

**出力データ**:
```json
{
  "recommended_factories": [
    {
      "factory_id": "string",
      "score": "number",
      "reason": "string",
      "estimated_capacity": "number"
    }
  ],
  "selection_criteria": {
    "speciality_match": "boolean",
    "capacity_sufficient": "boolean", 
    "reliability_score": "number"
  }
}
```

### 3. Communication Agent (通信エージェント)

**役割**: 外部通信チャネルとの統合・メッセージ送受信

**サポート通信方式**:
- **Email**: SMTP/IMAP統合
- **Microsoft Teams**: Graph API統合
- **システム内通知**: WebSocket/Push通知

**送信機能**:
```python
class CommunicationAgent:
    def send_request(self, factory, request_data, channel="email"):
        template = select_template(request_data.type, channel)
        message = render_template(template, request_data)
        
        if channel == "email":
            return send_email(factory.contact_email, message)
        elif channel == "teams":
            # Teams チャットタイトルにも依頼IDを含める
            chat_title = f"[{request_data.request_id}] 生産調整依頼"
            return send_teams_message(factory.teams_channel, message, chat_title)
    
    def track_delivery(self, message_id):
        return get_delivery_status(message_id)
```

**メッセージテンプレート**:
```
件名: [{request_id}] 【生産調整依頼】{product_name} {adjustment_type} {quantity}個
---
{factory_name} 御中

お疲れ様です。
下記条件にて生産調整をお願いいたします。

■依頼内容
・依頼ID: {request_id}
・製品名: {product_name}
・調整種別: {adjustment_type}
・依頼数量: {quantity}個
・返答期限: {response_deadline}
・納期: {delivery_date}
・優先度: {priority}
・依頼理由: {reason}

■回答項目
1. 受諾可否: [受諾/拒否/条件付き受諾]
2. 対応可能数量: ___個
3. 対応可能期限: ___年___月___日
4. 追加コスト: ___円
5. コメント: _______________

返答期限までに、件名に依頼ID「{request_id}」を含めてご回答をお願いいたします。
```

### 4. Response Processing Agent (回答処理エージェント)

**役割**: 工場回答の自動解析・構造化データ抽出

**処理フロー**:
```python
def process_factory_response(message):
    # 1. メッセージの前処理
    cleaned_text = preprocess_message(message.content)
    
    # 2. 依頼IDの特定（件名・チャットタイトルから抽出）
    request_id = extract_request_id(message.subject, message.content)
    
    # 3. 回答要素の抽出
    response_data = {
        "acceptance_status": extract_acceptance(cleaned_text),
        "available_quantity": extract_quantity(cleaned_text),
        "proposed_deadline": extract_date(cleaned_text),
        "additional_cost": extract_cost(cleaned_text),
        "comments": extract_comments(cleaned_text)
    }
    
    # 4. 信頼度スコアの算出
    confidence_score = calculate_confidence(response_data)
    
    # 5. 低信頼度の場合は人間レビューへ
    if confidence_score < 0.8:
        return escalate_to_human(message, response_data)
    
    return response_data
```

**NLP処理技術**:
- **依頼ID抽出**: 件名・チャットタイトルから依頼IDパターンの抽出
- **キーワード抽出**: 「受諾」「拒否」「条件付き」等の決定語
- **数値抽出**: 数量・金額・日付の正規表現パターン
- **感情分析**: ポジティブ・ネガティブ判定
- **信頼度評価**: 抽出結果の確信度測定

**エラーハンドリング**:
- 曖昧な回答の人間エスカレーション
- 必須項目未回答の確認依頼送信
- 矛盾データの検証・再確認

### 5. Status Management Agent (ステータス管理エージェント)

**役割**: システムステータスの自動更新・履歴管理

**ステータス更新ロジック**:
```python
def update_request_status(request_id, response_data):
    current_request = get_request(request_id)
    
    # ステータス遷移の決定
    new_status = determine_new_status(
        current_request.status, 
        response_data.acceptance_status
    )
    
    # ステータス履歴の記録
    create_status_history(
        request_id=request_id,
        previous_status=current_request.status,
        new_status=new_status,
        changed_by="SYSTEM_AGENT",
        change_reason="Factory response processed"
    )
    
    # メインレコードの更新
    update_request(request_id, {
        "status": new_status,
        "updated_at": datetime.now()
    })
    
    # 関連する通知の送信
    send_status_notification(request_id, new_status)
```

**ステータス遷移ルール**:
```
送信済み + 工場回答受信 → 回答済み
回答済み + 受諾回答 → 承認済み (自動) 
回答済み + 拒否回答 → 拒否
回答済み + 条件付き受諾 → 確認中 (人間判断待ち)
```

## 通信統合アーキテクチャ

### Email統合

**受信処理**:
```python
class EmailProcessor:
    def __init__(self):
        self.imap_client = IMAPClient(
            host=EMAIL_SERVER,
            username=EMAIL_USER,
            password=EMAIL_PASS
        )
    
    def monitor_responses(self):
        # 新着メールの監視
        messages = self.imap_client.search(['UNSEEN', 'SUBJECT', '生産調整'])
        
        for msg_id in messages:
            message = self.imap_client.fetch(msg_id, ['RFC822'])
            self.process_factory_response(message)
```

### Microsoft Teams統合

**Teams Bot Framework**:
```python
class TeamsBot(ActivityHandler):
    async def on_message_activity(self, turn_context: TurnContext):
        message_text = turn_context.activity.text
        
        # 工場回答の判定（依頼IDの確認も含む）
        if self.is_factory_response(message_text):
            response_data = self.response_agent.process(message_text)
            await self.status_agent.update_status(response_data)
            
            # 確認メッセージの送信
            await turn_context.send_activity(
                MessageFactory.text("回答を受信し、システムを更新しました。")
            )
    
    def create_production_request_chat(self, request_id, factory_info):
        # チャットタイトルに依頼IDを含める
        chat_title = f"[{request_id}] 生産調整依頼 - {factory_info.name}"
        return self.create_chat(chat_title, factory_info.teams_members)
```

## セキュリティ・プライバシー考慮事項

### 認証・認可
- **OAuth 2.0**: Teams API認証
- **API Key**: メールサーバー認証  
- **Role-based Access**: エージェント権限制御

### データ保護
- **暗号化**: 通信データ・保存データの暗号化
- **監査ログ**: 全エージェント活動の記録
- **個人情報保護**: 連絡先・コメント情報の適切な管理

## 運用・監視

### パフォーマンス監視
- **応答時間**: 各エージェントの処理時間測定
- **成功率**: 自動処理の成功・失敗率
- **スループット**: 時間あたり処理依頼数

### アラート設定
- **処理失敗**: エージェント処理エラー
- **通信障害**: メール・Teams接続問題
- **異常パターン**: 予期しない回答形式

### 継続的改善
- **学習データ**: 処理結果のフィードバック収集
- **アルゴリズム改善**: 工場選定精度の向上
- **テンプレート最適化**: 回答率向上のためのメッセージ改善

## 実装フェーズ

### Phase 1: 基盤構築 (4週間)
- [ ] Coordination Agent基本フレームワーク
- [ ] Database統合・API設計
- [ ] 基本的なメール送受信機能

### Phase 2: コア機能実装 (6週間)  
- [ ] Factory Selection Agentアルゴリズム
- [ ] Response Processing Agent (基本NLP)
- [ ] Status Management Agent

### Phase 3: 高度機能・統合 (4週間)
- [ ] Teams統合
- [ ] 高度なNLP処理
- [ ] 監視・アラート機能

### Phase 4: 運用最適化 (2週間)
- [ ] パフォーマンスチューニング
- [ ] セキュリティ監査
- [ ] ユーザートレーニング

## 期待効果

### 効率化効果
- **処理時間短縮**: 手動作業の80%削減
- **対応速度向上**: 依頼送信までの時間を1/5に短縮
- **ヒューマンエラー削減**: 入力ミス・送信忘れの撲滅

### 品質向上効果  
- **工場選定精度向上**: データ駆動による最適化
- **回答処理の標準化**: 人的判断のばらつき解消
- **履歴・監査証跡**: 完全な処理記録の自動化

この自動化アーキテクチャにより、生産調整プロセスの大幅な効率化と品質向上を実現します。