# 🛠️ DEVELOPER GUIDE — おしゃべりカメラ

開発者向けの技術解説です。アーキテクチャ・セットアップ手順・ペルソナ追加方法などをまとめています。

---

## 📐 アーキテクチャ概要

```
ブラウザ（React SPA）
  └── 📷 カメラ撮影
       └── 🤖 Gemini Flash Lite  →  キャラクタープロフィール生成（JSON）
            └── 🎨 Gemini Flash Image  →  キャラクター画像生成
                 └── 🎙️ Gemini Live Audio  →  リアルタイム音声通話（100秒）
```

すべてのAI処理は **フロントエンドから直接 Gemini API を呼び出す**クライアントサイドアーキテクチャです。サーバーは静的ファイル配信のみ（またはGitHub Pages）。

---

## 🗂️ ファイル構成

```
src/
├── App.tsx                  # メインコンポーネント・状態管理・UI全体
├── services/
│   └── gemini.ts            # Gemini API呼び出し・ペルソナ定義・プロンプト生成
└── lib/
    ├── audio.ts             # AudioRecorder / AudioStreamer (PCM16)
    └── ...
```

---

## 🤖 AI パイプライン詳細

### 1️⃣ キャラクタープロフィール生成 (`analyzeObject`)

**モデル:** `gemini-flash-lite-latest`
**入力:** 撮影画像（JPEG base64） + ペルソナ + 言語
**出力:** `CharacterProfile` JSON

```typescript
interface CharacterProfile {
  name: string;       // 正式名称
  nickname: string;   // あだ名（UIに表示）
  personality: string;
  catchphrase: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  description: string;
  trivia: string;     // 豆知識（ペルソナで深さが変わる）
  imageUrl?: string;  // base64 PNG（Step2で付与）
}
```

ペルソナと言語に応じて **プロンプトが自動分岐**します：
- 子ども向け: 「子供が『へぇ〜！』と思うような豆知識」
- 大人向け: 「歴史的背景・科学的メカニズム・意外な事実」

### 2️⃣ キャラクター画像生成

**モデル:** `gemini-2.5-flash-image`
**入力:** 元画像 + `profile.visualPrompt`
**出力:** PNG画像（base64）

- 子ども向け: kawaii 2Dアニメスタイル
- 大人向け: 知的でユニークなイラスト風

失敗しても通話は継続（fallback: 撮影写真をそのまま表示）。

### 3️⃣ リアルタイム音声通話 (`GeminiLiveSession`)

**モデル:** `gemini-2.5-flash-native-audio-preview-09-2025`
**入力:** PCM16音声ストリーム（16kHz）
**出力:** PCM16音声ストリーム + テキスト文字起こし

システムインストラクションは `buildSystemInstruction()` で生成。ペルソナ × 言語の組み合わせで語彙・文体を制御。

---

## 👤 ペルソナシステム

### 定義場所

`src/services/gemini.ts` の `PERSONAS` 定数：

```typescript
export const PERSONAS: Persona[] = [
  { id: 'tiny',       label: 'ちびっこ',       emoji: '👶', ageRange: '2-3歳',  ageNum: 3,  isChild: true,  sectionLabel: 'こども', promptHint: '...' },
  { id: 'kinder',     label: 'ようちえん',     emoji: '🌸', ageRange: '4-6歳',  ageNum: 5,  isChild: true,  sectionLabel: 'こども', promptHint: '...' },
  { id: 'elementary', label: 'しょうがくせい', emoji: '🎒', ageRange: '7-12歳', ageNum: 10, isChild: true,  sectionLabel: 'こども', promptHint: '...' },
  { id: 'adult',      label: 'おとな',         emoji: '🧠', ageRange: '大人',   ageNum: 30, isChild: false, sectionLabel: 'おとな', promptHint: '...' },
  { id: 'expert',     label: 'ガチ博士',       emoji: '🔬', ageRange: '専門家', ageNum: 35, isChild: false, sectionLabel: 'おとな', promptHint: '...' },
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

新しい言語を追加する場合は `getVocabularyInstruction` に `if (isXX)` ブランチを追加し、`App.tsx` の `LANGUAGES` にエントリを追加してください。

---

## ⚙️ セットアップ

### 必要なもの

- Node.js 18+
- Gemini API キー（[Google AI Studio](https://aistudio.google.com/) で取得）

### ローカル起動

```bash
# 依存関係をインストール
npm install

# APIキーを設定
echo "GEMINI_API_KEY=your_key_here" > .env.local

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

## 🌍 デプロイ

GitHub Pages を使ったデプロイ設定が含まれています。

```bash
# gh-pagesブランチにデプロイ（設定済みの場合）
npm run build
# distをGitHub Pagesのソースに設定してください
```

---

## 🔑 環境変数

| 変数名 | 必須 | 説明 |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google AI StudioのGemini APIキー |

`.env.local` に記載してください。`.gitignore` 済みで誤ってコミットされません。

---

## 💰 コスト目安（1セッションあたり）

| コンポーネント | モデル | 概算コスト |
|---|---|---|
| キャラクター生成 | gemini-flash-lite-latest | < $0.001 |
| 画像生成 | gemini-2.5-flash-image | ~$0.01–0.03 |
| 音声通話（100秒） | gemini-2.5-flash-native-audio-preview | ~$0.001–0.005 |
| **合計** | | **~$0.01–0.04 / セッション** |

> ⚠️ プレビューモデルは価格が変動する場合があります。[公式価格ページ](https://ai.google.dev/pricing)で最新情報を確認してください。

---

## 🚦 アプリの状態遷移

```
setup → camera → analyzing → incoming → talking → ended
  ↑                                                  |
  └──────────── reset() ─────────────────────────────┘
```

| 状態 | 説明 |
|---|---|
| `setup` | ペルソナ・言語選択画面 |
| `camera` | カメラプレビュー・撮影待ち |
| `analyzing` | Gemini APIによる解析中 |
| `incoming` | 着信風UI（緑ボタンで通話開始） |
| `talking` | ライブ音声通話中（100秒タイマー） |
| `ended` | 通話終了・再プレイボタン |

---

## 📝 主要な型定義

```typescript
// ペルソナ定義
interface Persona {
  id: string;
  label: string;        // 表示名
  emoji: string;
  ageRange: string;     // 表示用（「4-6歳」など）
  ageNum: number;       // AIプロンプトに渡す数値年齢
  promptHint: string;   // キャラクター生成プロンプトへの追加指示
  isChild: boolean;     // true=こどもセクション、false=おとなセクション
  sectionLabel: string; // UIグルーピング用
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
```
