# ExecPlan: ガチャ電話（ハイブリッドプラン：Web Speech STT + LLM + TTS 構成）へのリファクタリング

## 目的
アプリを「ガチャ電話」としてリニューアルし、不満点であった「音声認識の精度（英語が聞き取られない）」および「レスポンスの遅さ」を解消する。
Groq APIが利用不可であるため、ブラウザ標準のWeb Speech APIをSTTの代替としたハイブリッド構成でアーキテクチャを刷新する。

## 目標 (Goals)
1. **STT (音声認識)**: ブラウザ標準の Web Speech API (`SpeechRecognition`) を導入する。言語設定（`lang`）を明示的に指定することで、Gemini Live APIよりも英語の認識精度を向上させる。
2. **LLM (AI思考) とシステムプロンプトの固定化**: 音声認識で得たテキストを、Gemini 1.5 Flash（またはユーザーが選択したLLM）に送信する。「カストーマス」を防ぐため、システムプロンプトを強力に固定化し、直近の会話履歴を適切に管理してプロンプトに組み込む。
3. **TTS (音声合成)**: AIからのテキスト返答を読み上げるTTSを統合する。候補はOpenAI TTS（推奨）またはWeb Speech APIのSpeechSynthesis。
4. **UI/UX の改善**: 自動の無音判定から、ユーザーがタップして録音開始・終了（送信）を制御するトランシーバー形式のUIに変更し、レスポンスの遅延感をなくす。「Thinking...」などのフィードバックを表示する。

## 前提条件 (Prerequisites)
- [ ] LLM用のAPIキーの準備（既存のGemini APIキーを引き続き使用可能）。
- [ ] TTS用のAPIキーの準備（OpenAI TTSを使用する場合）。Web Speech APIのSpeechSynthesisを使用する場合は不要。

## システムアーキテクチャ案
| コンポーネント | 技術                                                                                         | コスト                         | メリット / デメリット                                                                        |
| -------------- | -------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------- |
| STT (耳)       | **Web Speech API (`SpeechRecognition`)**                                                     | 0円                            | 無料。`lang`設定で言語特化の精度向上。ブラウザ依存度が高い。                                 |
| LLM (脳)       | **Gemini 1.5 Flash** (既存のキー利用)                                                        | ほぼ無料枠内                   | 無料枠があり高速。                                                                           |
| TTS (口)       | **OpenAI TTS (`tts-1`)** または **ElevenLabs** または **Web Speech API (`SpeechSynthesis`)** | OpenAI: 約0.1円/回<br>Web: 0円 | OpenAIは高品質・低価格。Web Speech APIは無料だがロボット感が強く声のバリエーションが少ない。 |

## 実装ステップ (Steps)

### Step 1: 音声録音・送信UIの改修（トランシーバー形式）
- `App.tsx` または音声関連コンポーネントを改修。
- GeminiのLive API（Websocket）から、REST API通信のフロー（STT -> LLM -> TTS -> 再生）に変更する。
- タップで録音開始・終了（送信）するUIに変更し、不要な待ち時間を解消する。状態管理（`idle`, `recording`, `processing`, `speaking`）を実装する。

### Step 2: STT (Web Speech API) の実装
- フロントエンドで `window.SpeechRecognition` または `window.webkitSpeechRecognition` を呼び出すロジックを実装。
- ユーザーが選択している言語（日本語・英語など）に応じて `recognition.lang` を動的に切り替える。
- 録音終了時に認識されたテキストを取得する。

### Step 3: LLM (Gemini) の連携実装
- `src/services/gemini.ts` を改修。
- STTで得たテキストを、強力に固定化されたSystem Promptと会話履歴（Context）とともにGemini 1.5 FlashのREST APIエンドポイントに送信し、テキストの返答を得る関数を実装。

### Step 4: TTS (音声合成) の連携と再生実装
- LLMからのテキスト返答をTTS API（OpenAI等、またはブラウザ標準API）に送信（または渡し）、音声データを取得・合成する処理を実装。
- 音声データを再生し、同時にテキストを画面に表示する。

### Step 5: 全体テストと微調整
- 英語・日本語での認識精度をテスト。
- キャラクターのブレ（カストーマス）が発生しないか、プロンプトと履歴の挙動をテスト。
- 各API間の連携がスムーズに行われ、トランシーバーUIでレスポンス遅延が解消されているか確認。

---

## セルフレビュー (Self-Review)
- **課題網羅性**: Groq(Whisper)が使用不可という制約に対して、Web Speech APIを代替とするハイブリッド構成を定義できているか？ -> **[OK] STTをWeb Speech APIに変更したプランを策定済み。**
- **ルールの遵守**: ExecPlanのフォーマットと命名規則（`./plans/YYMMDD_NN_PlanName.md`）に従っているか？ -> **[OK] `./plans/260301_04_ExecPlan_Hybrid.md` として保存。**
