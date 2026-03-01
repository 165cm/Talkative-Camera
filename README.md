# 📸 ガチャ電話 / Talkative Camera

> **Point your camera at anything — and it calls you back.**
> カメラを向けるだけで、モノがキャラクターになって電話してくれる！

<div align="center">

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-GitHub_Pages-emerald?style=for-the-badge)](https://165cm.github.io/Talkative-Camera/)

</div>

---

## ✨ What is this?

**Talkative Camera (ガチャ電話)** is a magical AI app that turns everyday objects into talking characters.
Snap a photo of anything — a cup, a toy, a piece of fruit — and that object comes to life as a unique character and calls you for a 100-second voice chat!
*New:* Powered by Web Speech STT & Browser SpeechSynthesis TTS — zero TTS cost, instant response, fully offline-capable voice pipeline!

**おしゃべりカメラ（ガチャ電話）**は、カメラで撮ったモノをAIがキャラクターに変えて、音声通話してくれる不思議なアプリです。
*最新版:* ブラウザネイティブ TTS に切り替え、OpenAI TTS コスト $0・レイテンシ大幅削減を実現。軽量モデル（Gemini 2.0 Flash Lite）採用で応答も爆速！

---

## 🎯 Who is it for?

| シーン             | 使い方                                                          |
| ------------------ | --------------------------------------------------------------- |
| 🍽️ 食事中の子ども   | スマホを渡してYouTube代わりに。目の前のモノが話しかけてくれる！ |
| 📚 小学生の学習     | 身の回りのモノについて、楽しく知識を深められる                  |
| 🧠 大人の知的好奇心 | 目の前のモノの歴史・科学を深掘り                                |
| 🌏 多言語家庭       | 英語・中国語・マレー語・タミル語・韓国語にも対応                |

---

## 🚀 How to Use / 使い方

### Step 1 — 設定画面でキャラクターを選ぶ

**だれが使う？** から選択：

| ペルソナ         | 対象               | AIの話し方                   |
| ---------------- | ------------------ | ---------------------------- |
| 👶 ちびっこ       | 2-3歳              | 超シンプル・短文・褒め多め   |
| 🌸 ようちえん     | 4-6歳              | ひらがな中心・やさしい言葉   |
| 🎒 しょうがくせい | 7-12歳             | 漢字も使う・本物の知識       |
| 🧠 おとな         | 大人               | 深い豆知識・歴史や科学の背景 |
| 🔬 ガチ博士       | 専門知識を求める人 | 学術的・専門的な詳細解説     |

**ことば** から言語を選択（6言語対応）：
🇯🇵 日本語 / 🇺🇸 English / 🇲🇾 Bahasa Melayu / 🇨🇳 中文 / 🇮🇳 தமிழ் / 🇰🇷 한국어

### Step 2 — 好きなものを撮影

カメラ画面で、お気に入りのモノ・食べ物・おもちゃなどを映して
大きなカメラボタンをタップ！思いがけないレアキャラが出る「ガチャ」要素を楽しんでください！

### Step 3 — 着信に出る

AIがキャラクターを生成して電話をかけてきます。
緑の電話ボタンをタップして会話スタート！

### Step 4 — ぽちっと押して話す🎤 (Tap to Talk)

会話中は**マイクボタンをタップ**して話しかけます。
もう一度タップすると送信完了！キャラクターがすぐに返事をしてくれます。タイマーが切れると、キャラクターが自然にバイバイしてくれます。

> 💡 **前回の設定は自動で記憶されます。** 毎回設定しなくてOK！

---

## 🌐 Supported Languages

| Language        | Script / Difficulty Guidance               |
| --------------- | ------------------------------------------ |
| 🇯🇵 日本語        | ひらがな・漢字レベルで難易度を細かく制御   |
| 🇺🇸 English       | Vocabulary complexity adjusted per persona |
| 🇲🇾 Bahasa Melayu | Vocabulary complexity adjusted per persona |
| 🇨🇳 中文          | 汉字难度分级（简单汉字 → 复杂词汇）        |
| 🇮🇳 தமிழ்           | Vocabulary complexity adjusted per persona |
| 🇰🇷 한국어        | 어휘 난이도 페르소나별 조정                |

---

## ❓ よくある質問 / FAQ

**Q. 子どもに安全ですか？**
A. 会話は1回100秒で自動終了します。カメラ・マイクはブラウザ経由のみで使用し、データは送信後すぐ破棄されます。

**Q. インターネット接続は必要ですか？**
A. はい、Gemini APIへの接続が必要です。

**Q. オフラインでは使えません。**
A. 対応予定はありません（AI生成がサーバーサイドで動くため）。

**Q. どのデバイスで使えますか？**
A. カメラとマイクを持つスマートフォン・タブレット・PCのブラウザで動作します。Chrome推奨。

---

## 🔧 Self-hosting (for developers)

→ See [DEVELOPER.md](DEVELOPER.md)

---

## 📄 License

Apache 2.0 — see [LICENSE](LICENSE) file.
