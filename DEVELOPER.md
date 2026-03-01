# 🛠️ DEVELOPER GUIDE — おしゃべりカメラ（ガチャ電話）

開発者向けの技術解説です。アーキテクチャ・セットアップ手順・音声パイプライン詳細・拡張方法をまとめています。

---

## 📐 アーキテクチャ概要

```
ブラウザ（React SPA）
  └── 📷 カメラ撮影
       └── 🤖 Gemini Flash Lite  →  キャラクタープロフィール生成（JSON）
            └── 🎨 Gemini Flash  →  キャラクター画像生成
                 └── 🎙️ 音声会話ループ（ChatSession）
                      ├── STT: Web Speech API（ブラウザネイティブ）
                      ├── LLM: Gemini 2.0 Flash Lite（REST）
                      └── TTS: Web SpeechSynthesis API（ブラウザネイティブ）
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

**モデル:** `gemini-2.0-flash-lite` (または最新の Flash Lite)
**入力:** 撮影画像（JPEG base64） + ペルソナ + 言語
**出力:** `CharacterProfile` JSON

```typescript
interface CharacterProfile {
  name: string;       // 正式名称
  nickname: string;   // あだ名（UIに表示）
  personality: string;
  catchphrase: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'; // → ブラウザTTS pitch/rate にマッピング
  description: string;
  trivia: string;     // 豆知識（ペルソナで深さが変わる）
  imageUrl?: string;  // base64 PNG（Step2で付与）
}
```

### 2️⃣ キャラクター画像生成

**モデル:** `gemini-2.5-flash-preview-05-20` (画像生成対応モデル)
**入力:** 元画像 + キャラクター情報
**出力:** PNG画像（base64）

失敗しても通話は継続（fallback: 撮影写真をそのまま表示）。

### 3️⃣ 音声会話ループ (`ChatSession`)

ハイブリッド構成で高速・高精度を実現：

| 役割 | 技術 | 特徴 |
|---|---|---|
| **STT**（発話認識） | Web Speech API（ブラウザネイティブ） | 無料・低遅延・多言語対応 |
| **LLM**（応答生成） | Gemini 2.5 Flash REST API | 直近5ターンのみ送信・高速・低コスト |
| **TTS**（音声合成） | Web SpeechSynthesis API（ブラウザネイティブ） | 無料・即時再生・OS依存の音声 |

---

## 🎙️ 音声パイプライン詳細仕様

### フロー全体図

```
[ユーザーがマイクボタンをタップ]
        │
        ▼
speechSynthesis.cancel()       ← SpeechSynthesis をユーザージェスチャーでアンロック
SpeechRecognition.start()      ← ブラウザネイティブSTT起動（interimResults: true）
        │
[ユーザーが話す（インタリム結果はリアルタイムにバブル表示）]
        │
        ▼
SpeechRecognition.onresult(isFinal=true) ← 最終認識テキスト取得
setCallState('processing')
ChatSession.sendText(text)
        │
        ├─ Gemini 2.5 Flash API ─ 応答テキスト生成
        │         （直近5ターン history.slice(-10) を送信）
        │
        ▼
onTranscript('model', text)    ← UIに応答テキスト表示
setCallState('speaking')
        │
        ├─ SpeechSynthesisUtterance ─ ブラウザTTSで即時再生
        │         （voiceName → pitch/rate にマッピング）
        │
[音声再生終了]
        │
        ▼
onTurnComplete()
setCallState('idle')           ← 次の発話待ち状態へ
```

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
 │         Gemini応答完了     │
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

### voiceName → ブラウザ TTS パラメータ マッピング

`ChatSession.getVoiceParams()` で変換します：

| voiceName | pitch | rate | 特徴 |
|---|---|---|---|
| `Puck` | 1.3 | 1.0 | 子ども向け・明るい高音 |
| `Charon` | 0.7 | 0.9 | 重厚な低音・ゆっくり |
| `Kore` | 1.1 | 1.0 | やや高め・女声寄り |
| `Fenrir` | 0.9 | 1.0 | やや低め・力強い |
| `Zephyr` | 1.0 | 1.0 | 中性的・標準 |

ブラウザの言語別ボイスは `getBrowserVoice()` で `getLangCode()` の言語プレフィックスにマッチする最初のボイスを選択します。

`getBrowserVoice()` は **`async` 関数**です。ブラウザによっては `getVoices()` が最初の呼び出しで空配列を返すため、`voiceschanged` イベントを最大1秒待機してから再取得します。

```typescript
private async getBrowserVoice(): Promise<SpeechSynthesisVoice | null> {
  let voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    await new Promise<void>(resolve => {
      window.speechSynthesis.addEventListener('voiceschanged', () => resolve(), { once: true });
      setTimeout(resolve, 1000); // 最大1秒待機
    });
    voices = window.speechSynthesis.getVoices();
  }
  // 言語プレフィックスにマッチする最初のボイスを返す
  const langPrefix = this.getLangCode().substring(0, 2);
  const langVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
  return langVoices[0] || voices[0] || null;
}
```

### autoplay と SpeechSynthesis のアンロック

**問題**: `SpeechSynthesis.speak()` も非同期コールバック内からの呼び出しはブラウザによってブロックされる場合があります。

**対策**: `startCall()` の先頭（ユーザーのボタンタップ直後）で `speechSynthesis.cancel()` を呼び出し、SpeechSynthesis コンテキストをあらかじめアンロックします。

```typescript
// App.tsx — startCall() の先頭（ユーザージェスチャー内）
window.speechSynthesis.cancel();  // ← アンロック

// gemini.ts — sendText() 内（非同期・ジェスチャーコンテキスト外）
const utterance = new SpeechSynthesisUtterance(responseText);
utterance.lang = this.getLangCode();
window.speechSynthesis.speak(utterance);  // ← アンロック済みのため再生可能
```

### 既知の制約・改善余地

| 項目 | 現状 | 改善案 |
|---|---|---|
| STT精度 | ブラウザ依存（Chrome > Safari > Firefox） | Whisper API など外部STTへの切り替え |
| TTS音質 | OS/ブラウザ依存（デバイスで差あり） | ElevenLabs など高品質TTSへの切り替え |
| TTS遅延 | Gemini応答のみ = 600〜850ms | Gemini ストリーミング + センテンス単位TTS |
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
| `GEMINI_API_KEY` | Google AI Studio のAPIキー | Gemini API（キャラクター生成・画像生成・テキスト応答） |

> 以前の構成で `OPENAI_API_KEY` を設定していた場合は削除してかまいません。OpenAI TTS は廃止され、現在はブラウザ SpeechSynthesis API を使用しています。

3. GitHub リポジトリ → **Settings → Pages** → Source: `GitHub Actions` に設定

---

## 🔑 環境変数

| 変数名 | 必須 | 用途 |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Gemini API（キャラクター生成・画像生成・テキスト応答） |

**重要**: これらのキーは Vite の `define` により**クライアントサイドのバンドルに埋め込まれます**。本番運用でキー漏洩を防ぎたい場合は、バックエンドプロキシ（Cloudflare Workers / Vercel Functions 等）の導入を検討してください。

#### ⚠️ Vite ビルドと環境変数の扱いについて

`vite.config.ts` では `loadEnv()` と `process.env` の両方にフォールバックしています：

```typescript
// vite.config.ts
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
}
```

- **ローカル開発**: `.env.local` ファイルから `env.GEMINI_API_KEY` が読まれます
- **GitHub Actions**: `env:` ブロックの値が `process.env` に入るため、`loadEnv()` が `.env` ファイルを見つけられなくてもフォールバックで正しく埋め込まれます

> `loadEnv()` は `.env*` ファイルのみを参照し、`process.env` を直接参照しない点に注意してください。フォールバックがないと、CI環境でAPIキーが `"undefined"` としてバンドルされ、本番環境でAIの返答が来ない原因になります。

---

## 💰 コスト目安（1セッションあたり）

### 現行アーキテクチャ（フル無料TTS構成）

| コンポーネント | モデル | 概算コスト |
|---|---|---|
| キャラクター生成（STT） | Web Speech API | 無料 |
| キャラクター生成（テキスト） | Gemini Flash Lite | < $0.001 |
| キャラクター画像生成 | Gemini 2.5 Flash | ~$0.01–0.03 |
| 会話LLM（1ターンあたり） | Gemini 2.5 Flash | ~$0.001 |
| 音声合成（1ターンあたり） | Web SpeechSynthesis | **$0（無料）** |
| **1セッション合計（5ターン想定）** | | **~$0.01–0.03 / セッション** |

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
