# 🛠️ DEVELOPER GUIDE — おしゃべりカメラ（ガチャ電話）

開発者向けの技術解説です。アーキテクチャ・セットアップ手順・音声パイプライン詳細・拡張方法をまとめています。

---

## 📐 アーキテクチャ概要

```
ブラウザ（React SPA）
  └── 📷 カメラ撮影
       └── 🤖 Gemini Flash Lite  →  キャラクタープロフィール生成（JSON）
            └── 🎨 Imagen 4 Fast  →  キャラクター画像生成
                 └── 🎙️ 音声会話ループ（ChatSession）
                      ├── STT: Web Speech API（ブラウザネイティブ）
                      ├── LLM: Groq API / Llama-3.3-70B（高速推論）
                      └── TTS: Google Cloud TTS Neural2（高品質音声合成）
```

すべてのAI処理は **フロントエンドから直接 API を呼び出す**クライアントサイドアーキテクチャです。サーバーは静的ファイル配信のみ（GitHub Pages）。

---

## 🗂️ ファイル構成

```
src/
├── App.tsx                  # メインコンポーネント・状態管理・UI全体
├── i18n/
│   └── translations.ts      # 多言語辞書（6言語 × 22キー）+ t() / getLangCode()
├── services/
│   └── gemini.ts            # AI処理全般・ChatSession・ペルソナ定義・プロンプト生成
└── lib/
    ├── audio.ts             # 旧アーキテクチャ用（現在未使用）
    └── usageTracker.ts      # 日次使用量カウンター（localStorage）
```

---

## 🤖 AI パイプライン詳細

### 1️⃣ キャラクタープロフィール生成 (`analyzeObject`)

**モデル:** `gemini-flash-lite-latest`（最新 Flash Lite を自動追従するエイリアス）
**入力:** 撮影画像（JPEG base64） + ペルソナ + 言語
**出力:** `CharacterProfile` JSON

```typescript
interface QuizItem {
  question: string;    // 問題文（ペルソナ別難易度）
  answer: string;      // 正解（1〜3語）
  explanation: string; // 解説（50文字以内）
  hint: string;        // ヒント（20文字以内）
}

interface CharacterProfile {
  name: string;            // 正式名称
  nickname: string;        // あだ名（UIに表示）
  personality: string;
  catchphrase: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'; // → ブラウザTTS pitch/rate にマッピング
  description: string;
  trivia: string;          // 豆知識（ペルソナで深さが変わる）
  imageUrl?: string;       // base64 PNG（Step2で付与）
  isNamedCharacter: boolean; // 有名キャラ判定（true: 正確な口調を再現 / false: 擬人化）
  quizzes: QuizItem[];     // 3問のクイズ（ペルソナ別難易度・多言語対応）
}
```

**有名キャラ vs 擬人化の分岐**:
- `isNamedCharacter: true` — 機関車トーマス・ピカチュウなどの場合、公式の口調・口癖を忠実に再現
- `isNamedCharacter: false` — リンゴ・時計などの場合、オリジナルの擬人化キャラを創作

**クイズ難易度はペルソナに連動**:

| ペルソナ | クイズ難易度 |
|---|---|
| tiny | 超かんたん（色・形・音など感覚的な質問） |
| kinder | かんたん（どこにある？何に使う？など） |
| elementary | ふつう（どうやって作られる？産地は？など） |
| adult | 深い（歴史・科学・文化的背景） |
| expert | 専門的・学術的（詳細なメカニズム・専門用語） |

### 2️⃣ キャラクター画像生成

**モデル:** `imagen-4.0-fast-generate-001`（Imagen 4 Fast・テキスト→画像）
**入力:** キャラクタープロフィールの `visualPrompt`（Step 1 で生成した英語プロンプト） + スタイル指示
**出力:** JPEG画像（base64）

> Step 1 の Gemini Flash Lite が撮影写真を解析して `visualPrompt`（色・形状・雰囲気の英語記述）を生成するため、元写真を直接参照しなくても視覚的特徴が引き継がれます。
> 失敗しても通話は継続（fallback: 撮影写真をそのまま表示）。

### 3️⃣ 音声会話ループ (`ChatSession`)

ハイブリッド構成で高速・高精度を実現：

| 役割 | 技術 | 特徴 |
|---|---|---|
| **STT**（発話認識） | Web Speech API（ブラウザネイティブ） | 無料・低遅延・多言語対応 |
| **LLM**（応答生成） | Groq API / `llama-3.3-70b-versatile` | OpenAI互換・超高速推論・無料枠14,400req/日 |
| **TTS**（音声合成） | Google Cloud TTS Neural2 | 高品質・低レイテンシ・多言語Neural2音声 |

---

## 🎙️ 音声パイプライン詳細仕様

### フロー全体図

```
[startCall() — 緑ボタンタップ直後]
        │
        ▼
chatSession.sendText(greetMsg, isSystem=true)  ← 自動トリガー（UIには表示しない）
        │
        ├─ Groq API (Llama-3.3-70B) ─ 挨拶 + 豆知識 + クイズQ1 を生成
        │
        ▼
onTranscript('model', text)    ← キャラクターの最初の発話を表示
Google Cloud TTS Neural2       ← 音声で読み上げ（MP3 → AudioContext 再生）

[ユーザーがマイクボタンをタップしてクイズに回答]
        │
        ▼
SpeechRecognition.start()      ← ブラウザネイティブSTT起動（interimResults: true）
        │
[ユーザーが話す（インタリム結果はリアルタイムにバブル表示）]
        │
        ▼
SpeechRecognition.onresult(isFinal=true) ← 最終認識テキスト取得
setCallState('processing')
ChatSession.sendText(text)     ← isSystem=false（UIに表示）
        │
        ├─ Groq API (Llama-3.3-70B) ─ 正解/不正解判定 + 解説 + 次のクイズ生成
        │         （直近5ターン history.slice(-10) を送信）
        │
        ▼
onTranscript('model', text)    ← UIに応答テキスト表示
setCallState('speaking')
        │
        ├─ Google Cloud TTS Neural2 ─ 高品質音声合成・MP3 AudioContext 再生
        │         （voiceName → pitch/speakingRate にマッピング）
        │
[音声再生終了]
        │
        ▼
onTurnComplete()
setCallState('idle')           ← 次の発話待ち状態へ
```

> **`sendText(text, isSystem)`**: `isSystem=true` のとき、ユーザーメッセージとして `onTranscript` を呼ばず、会話履歴（`history`）にのみ追加します。通話開始直後の自動トリガーやタイムアップ通知に使用します。

### callState 遷移図

```
         マイクタップ
idle ──────────────────► listening
 ▲                           │
 │           音声認識完了      │
 │    ◄──── (onresult)  ─────┤
 │                           ▼
 │                       processing
 │                           │
 │         Groq応答完了       │
 │    ◄──── (onTranscript) ──┤
 │                           ▼
 │                        speaking
 │                           │
 │         音声再生終了       │
 └──────── (onended) ────────┘
```

| 状態 | 意味 | UIの表示 |
|---|---|---|
| `idle` | 発話待ち | 「ぽちっと押して話す🎤」 |
| `listening` | STT録音中 | 「きいているよ！👂...」（マイクボタンが赤） |
| `processing` | LLM + TTS 処理中 | 「かんがえているよ！🤔...」 |
| `speaking` | 音声再生中 | 「おはなしちゅう👄...」 |

### voiceName → Google Cloud TTS パラメータ マッピング

`ChatSession.getVoiceParams()` / `getGoogleVoiceName()` で変換します：

| voiceName | pitch（セミトーン） | speakingRate | 特徴 |
|---|---|---|---|
| `Puck` | +3.0 | 1.0 | 子ども向け・明るい高音 |
| `Charon` | -3.0 | 0.9 | 重厚な低音・ゆっくり |
| `Kore` | +1.0 | 1.0 | やや高め・女声寄り |
| `Fenrir` | -1.0 | 1.0 | やや低め・力強い |
| `Zephyr` | 0.0 | 1.0 | 中性的・標準 |

> `pitch` は SpeechSynthesis の 0〜2 スケールを `(pitch - 1.0) * 10` でセミトーン（-20〜+20）に変換しています。

**言語別 Neural2 音声マッピング** (`getGoogleVoiceName()`):

| 言語コード | 音声名 |
|---|---|
| `ja-JP` | `ja-JP-Neural2-B` |
| `en-US` | `en-US-Neural2-C` |
| `zh-CN` | `cmn-CN-Wavenet-A` |
| `ko-KR` | `ko-KR-Neural2-A` |
| `ms-MY` | `ms-MY-Wavenet-A` |
| `ta-IN` | `ta-IN-Standard-A` |

**Google Cloud TTS 再生フロー** (`speakWithGoogleTTS()`):

```typescript
// 1. REST API でMP3を取得（Base64）
const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=...`);
const { audioContent } = await res.json();

// 2. Base64 → ArrayBuffer → AudioBuffer
const buffer = await audioContext.decodeAudioData(bytes.buffer);

// 3. AudioBufferSourceNode で再生・終了を Promise で待機
source.onended = () => resolve();
source.start();
```

### autoplay と AudioContext のアンロック

**問題**: `AudioContext` もユーザージェスチャー外では `suspended` 状態になりブロックされます。

**対策**: `startCall()` のユーザータップ時に `AudioContext` を初期化・`resume()` しておくか、`speakWithGoogleTTS()` 内の最初の呼び出しで `new AudioContext()` を行います（ジェスチャーの恩恵を受けた非同期チェーン内であればブロックされません）。

### 既知の制約・改善余地

| 項目 | 現状 | 改善案 |
|---|---|---|
| STT精度 | ブラウザ依存（Chrome > Safari > Firefox） | Whisper API など外部STTへの切り替え |
| TTS音質 | Google Cloud TTS Neural2（高品質） | ElevenLabs Flash でさらに低レイテンシ化 |
| LLM遅延 | Groq Llama-3.3-70B = ~200ms | さらに小型モデル（8B等）への切り替え |
| API キー露出 | クライアントサイドにキーを埋め込み | バックエンドプロキシの追加 |
| 会話履歴 | 直近5ターン（10件）のみ送信 | 長期会話での要約圧縮 |
| 音声割り込み | 再生中はマイクボタン操作不可 | 割り込み検出・中断機能 |

---

## 👤 ペルソナシステム

### 定義場所

`src/services/gemini.ts` の `PERSONAS` 定数：

```typescript
export const PERSONAS: Persona[] = [
  { id: 'tiny',       label: 'ちびっこ',       emoji: '👶', ageRange: '2-3歳',  ageNum: 3,  isChild: true,  sectionLabel: 'こども' },
  { id: 'kinder',     label: 'ようちえん',     emoji: '🌸', ageRange: '4-6歳',  ageNum: 5,  isChild: true,  sectionLabel: 'こども' },
  { id: 'elementary', label: 'しょうがくせい', emoji: '🎒', ageRange: '7-12歳', ageNum: 10, isChild: true,  sectionLabel: 'こども' },
  { id: 'adult',      label: 'おとな',         emoji: '🧠', ageRange: '大人',   ageNum: 30, isChild: false, sectionLabel: 'おとな' },
  { id: 'expert',     label: 'ガチ博士',       emoji: '🔬', ageRange: '専門家', ageNum: 35, isChild: false, sectionLabel: 'おとな' },
];
```

### 新しいペルソナを追加する手順

1. `PERSONAS` 配列にエントリを追加（`sectionLabel` で「こども」「おとな」のどちらかに振り分け）
2. `buildSystemInstruction()` 内に `if (persona.id === 'YOUR_ID')` ブロックを追加
3. `getVocabularyInstruction()` 内に `if (personaId === 'YOUR_ID')` ブロックを追加（子ども向けの場合）
4. UIは `PERSONAS.filter(p => p.isChild)` / `PERSONAS.filter(p => !p.isChild)` で自動反映される

---

## 🌐 語彙レベルの多言語対応

`getVocabularyInstruction(personaId, language)` 関数で、子ども向けペルソナ × 言語の組み合わせごとに語彙指示を生成します。

| ペルソナ | 日本語 | English | 中文 | 한국어 | その他 |
|---|---|---|---|---|---|
| tiny | ひらがなのみ | 1-2音節のみ | 小1レベル漢字 | 쉬운 단어 | Simple words |
| kinder | ひらがな中心 | Simple vocab | 简单汉字 | 쉬운 단어 중심 | Simple vocab |
| elementary | 小学校漢字OK | Moderate vocab | 稍复杂汉字 | 어느 정도 OK | Moderate vocab |

新しい言語を追加する場合は、以下の3箇所を更新してください：
1. `getVocabularyInstruction` に `if (isXX)` ブランチを追加
2. `App.tsx` の `LANGUAGES` にエントリを追加
3. `src/i18n/translations.ts` の `translations` オブジェクトに新言語の全キーを追加
4. `ChatSession` 内の `langMapping` にもエントリを追加（Web Speech API の言語コード）

---

## ⚙️ セットアップ

### 必要なもの

- Node.js 18+
- Gemini API キー（[Google AI Studio](https://aistudio.google.com/) で取得）

### ローカル起動

```bash
# 依存関係をインストール
npm install

# APIキーを設定（.env.local は .gitignore 済み）
cat > .env.local << EOF
GEMINI_API_KEY=your_gemini_key_here
GROQ_API_KEY=your_groq_key_here
GOOGLE_TTS_API_KEY=your_google_tts_key_here
EOF

# 開発サーバー起動（http://localhost:3000）
npm run dev
```

### ビルド

```bash
npm run build    # distフォルダにビルド
npm run preview  # ビルド結果をプレビュー
npm run lint     # TypeScriptエラーチェック
```

---

## 🌍 デプロイ（GitHub Pages）

`main` ブランチへの push で `.github/workflows/deploy.yml` が自動実行されます。

### 初回設定

1. GitHub リポジトリ → **Settings → Secrets and variables → Actions**
2. 以下のシークレットを追加：

| シークレット名 | 値 | 用途 |
|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio のAPIキー | Gemini API（キャラクター生成・画像生成） |
| `GROQ_API_KEY` | Groq Console のAPIキー | 会話LLM（Llama-3.3-70B） |
| `GOOGLE_TTS_API_KEY` | Google Cloud Console のAPIキー | 音声合成（Neural2） |

> `GROQ_API_KEY` は [Groq Console](https://console.groq.com/) で無料取得できます。
> `GOOGLE_TTS_API_KEY` は [Google Cloud Console](https://console.cloud.google.com/) で **Text-to-Speech API** を有効化後に作成してください（APIキー制限: Text-to-Speech API のみ許可推奨）。

3. GitHub リポジトリ → **Settings → Pages** → Source: `GitHub Actions` に設定

---

## 🔑 環境変数

| 変数名 | 必須 | 用途 |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Gemini API（キャラクター生成・Imagen 4 画像生成） |
| `GROQ_API_KEY` | ✅ | Groq API（会話LLM: Llama-3.3-70B） |
| `GOOGLE_TTS_API_KEY` | ✅ | Google Cloud TTS（Neural2 音声合成） |

**重要**: これらのキーは Vite の `define` により**クライアントサイドのバンドルに埋め込まれます**。本番運用でキー漏洩を防ぎたい場合は、バックエンドプロキシ（Cloudflare Workers / Vercel Functions 等）の導入を検討してください。

#### ⚠️ Vite ビルドと環境変数の扱いについて

`vite.config.ts` では `loadEnv()` と `process.env` の両方にフォールバックしています：

```typescript
// vite.config.ts
define: {
  'process.env.GEMINI_API_KEY':    JSON.stringify(env.GEMINI_API_KEY    || process.env.GEMINI_API_KEY),
  'process.env.GROQ_API_KEY':      JSON.stringify(env.GROQ_API_KEY      || process.env.GROQ_API_KEY),
  'process.env.GOOGLE_TTS_API_KEY':JSON.stringify(env.GOOGLE_TTS_API_KEY|| process.env.GOOGLE_TTS_API_KEY),
}
```

- **ローカル開発**: `.env.local` ファイルから各キーが読まれます
- **GitHub Actions**: `env:` ブロックの値が `process.env` に入るため、`loadEnv()` が `.env` ファイルを見つけられなくてもフォールバックで正しく埋め込まれます

> `loadEnv()` は `.env*` ファイルのみを参照し、`process.env` を直接参照しない点に注意してください。フォールバックがないと、CI環境でAPIキーが `"undefined"` としてバンドルされ、本番環境でAIの返答が来ない原因になります。

---

## 💰 コスト目安（1セッションあたり）

### 現行アーキテクチャ（Groq + Google Cloud TTS 構成）

| コンポーネント | モデル | 概算コスト |
|---|---|---|
| 発話認識（STT） | Web Speech API | 無料 |
| キャラクター生成（テキスト） | gemini-flash-lite-latest | < $0.001 |
| キャラクター画像生成 | imagen-4.0-fast-generate-001 | ~$0.003–0.01 |
| 会話LLM（1ターンあたり） | Groq / llama-3.3-70b-versatile | **$0（無料枠 14,400req/日）** |
| 音声合成（1ターンあたり） | Google Cloud TTS Neural2 | ~$0.00016（約0.025円） |
| **1セッション合計（5ターン想定）** | | **~$0.004–0.015 / セッション** |

> Groq の無料枠（14,400リクエスト/日）を超えた場合は有料プランへの切り替えが必要です。Google Cloud TTS Standard は 4,000,000文字/月まで無料です。

### 日次上限設定（`src/lib/usageTracker.ts`）

```typescript
export const MAX_SESSIONS_PER_DAY = 20;   // 1日の最大セッション数（~100円/日）
export const COST_PER_SESSION_YEN = 5;    // 1セッションあたりの概算コスト（円）
```

| 目安 | MAX_SESSIONS_PER_DAY | 概算コスト/日 |
|---|---|---|
| 個人利用 | 20 | ~100円 |
| 家庭向け | 40 | ~200円 |
| 小規模公開 | 100 | ~500円 |

> ⚠️ プレビューモデルは価格が変動する場合があります。最新価格は [Gemini](https://ai.google.dev/pricing) の公式ページで確認してください。

---

## 🚦 アプリの状態遷移

### アプリ全体 (`AppState`)

```
language → setup → camera → analyzing → incoming → talking → ended
  ▲           ▲                                               │
  │           └──────────── reset() ─────────────────────────┘
  └── setup画面の「変更」リンクからも遷移可
```

| 状態 | 説明 |
|---|---|
| `language` | 言語選択画面（初回起動時 or 「変更」リンク押下時） |
| `setup` | ペルソナ・言語確認画面（言語選択済みの場合は最初から表示） |
| `camera` | カメラプレビュー・撮影待ち |
| `analyzing` | Gemini APIによるキャラクター解析中 |
| `incoming` | 着信風UI（緑ボタンで通話開始） |
| `talking` | 音声会話中（100秒タイマー） |
| `ended` | 通話終了・再プレイボタン |

選択した言語・ペルソナは `localStorage` に保存され、次回起動時は `setup` から始まります。

### 会話中の状態 (`callState`)

```
idle → listening → processing → speaking → idle
```

詳細は [音声パイプライン詳細仕様](#️-音声パイプライン詳細仕様) を参照。

---

## 📝 主要な型定義

```typescript
// アプリ全体の画面状態
type AppState = 'language' | 'setup' | 'camera' | 'analyzing' | 'incoming' | 'talking' | 'ended';

// 会話中の音声入出力状態
type CallState = 'idle' | 'listening' | 'processing' | 'speaking';

// ペルソナ定義
interface Persona {
  id: string;
  label: string;                              // 日本語デフォルト表示名
  emoji: string;
  ageRange: string;                           // 日本語デフォルト年齢表示
  ageNum: number;                             // AIプロンプトに渡す数値年齢
  promptHint: string;                         // キャラクター生成プロンプトへの追加指示
  isChild: boolean;                           // true=こどもセクション
  sectionLabel: string;                       // UIグルーピング用
  localizedLabels: Record<string, string>;    // 言語ラベル → 表示名
  localizedAgeRanges: Record<string, string>; // 言語ラベル → 年齢表示
}

// クイズ1問分
interface QuizItem {
  question: string;
  answer: string;
  explanation: string;
  hint: string;
}

// AIが生成するキャラクタープロフィール
interface CharacterProfile {
  name: string;
  nickname: string;
  personality: string;
  catchphrase: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  description: string;
  trivia: string;
  imageUrl?: string;
  isNamedCharacter: boolean; // 有名キャラならtrue（公式口調を使う）
  quizzes: QuizItem[];       // ペルソナ別難易度で3問生成
}

// ChatSession コールバック
interface ChatCallbacks {
  onTranscript: (speaker: 'user' | 'model', text: string, isFinal: boolean, isDelta: boolean) => void;
  onTurnComplete: () => void;
  onError: (err: any) => void;
}
```

---

## 🌐 多言語対応（i18n）

UIテキストは `src/i18n/translations.ts` で一元管理しています。

```typescript
import { t, getLangCode } from './i18n/translations';

const langCode = getLangCode(language); // '日本語' → 'ja' などに変換
t('setup.startButton', langCode);       // → 'はじめる！' / 'Let's Go!' など
t('ended.messageChild', langCode, { name: 'コップくん' }); // {name} 置換
```

翻訳キーを追加する場合は `TranslationKey` 型に追記し、6言語すべてに値を設定してください。

---

## 📊 日次使用量制限

### 仕組み

- 使用量は `localStorage` に `{ date, sessions, estimatedCostYen }` 形式で保存
- 日付が変わると自動リセット
- ホーム画面に小さく `🛠 Dev: Today X/20 (~X¥)` として表示（開発者確認用）
- 上限到達時はスタートボタンがグレーアウトし、撮影がブロックされます

> ⚠️ localStorage ベースのため、ブラウザのデータ削除で回避可能です。本格的な制限が必要な場合はサーバーサイドでの管理をご検討ください。
