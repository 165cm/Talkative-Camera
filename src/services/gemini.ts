import { GoogleGenAI, Content } from "@google/genai";

export interface QuizItem {
  question: string;
  answer: string;
  explanation: string;
  hint: string;
}

export interface CharacterProfile {
  name: string;
  nickname: string;
  personality: string;
  catchphrase: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  description: string;
  trivia: string;
  imageUrl?: string; // Base64 encoded image
  isNamedCharacter: boolean;
  quizzes: QuizItem[];
}

export interface Persona {
  id: string;
  label: string;
  emoji: string;
  ageRange: string;
  ageNum: number;
  promptHint: string;
  isChild: boolean;
  sectionLabel: string;
  localizedLabels: Record<string, string>;
  localizedAgeRanges: Record<string, string>;
}

export const PERSONAS: Persona[] = [
  {
    id: 'tiny',
    label: 'ちびっこ',
    emoji: '👶',
    ageRange: '2-3歳',
    ageNum: 3,
    isChild: true,
    sectionLabel: 'こども',
    promptHint: '超シンプルな言葉のみ。1〜2語の短い文。たくさん褒める。',
    localizedLabels: {
      '日本語': 'ちびっこ', 'English': 'Tiny', 'Bahasa Melayu': 'Si Kecil',
      '中文': '宝贝', 'தமிழ்': 'குழந்தை', '한국어': '아기',
    },
    localizedAgeRanges: {
      '日本語': '2-3歳', 'English': '2-3 yrs', 'Bahasa Melayu': '2-3 thn',
      '中文': '2-3岁', 'தமிழ்': '2-3 வயது', '한국어': '2-3세',
    },
  },
  {
    id: 'kinder',
    label: 'ようちえん',
    emoji: '🌸',
    ageRange: '4-6歳',
    ageNum: 5,
    isChild: true,
    sectionLabel: 'こども',
    promptHint: 'ひらがな中心、やさしい言葉、明るく楽しい雰囲気。',
    localizedLabels: {
      '日本語': 'ようちえん', 'English': 'Kinder', 'Bahasa Melayu': 'Tadika',
      '中文': '幼儿园', 'தமிழ்': 'மழலையர்', '한국어': '유치원',
    },
    localizedAgeRanges: {
      '日本語': '4-6歳', 'English': '4-6 yrs', 'Bahasa Melayu': '4-6 thn',
      '中文': '4-6岁', 'தமிழ்': '4-6 வயது', '한국어': '4-6세',
    },
  },
  {
    id: 'elementary',
    label: 'しょうがくせい',
    emoji: '🎒',
    ageRange: '7-12歳',
    ageNum: 10,
    isChild: true,
    sectionLabel: 'こども',
    promptHint: '漢字も少し使ってOK。本物の知識を楽しく伝える。',
    localizedLabels: {
      '日本語': 'しょうがくせい', 'English': 'Elementary', 'Bahasa Melayu': 'Sekolah',
      '中文': '小学生', 'தமிழ்': 'பள்ளி', '한국어': '초등학생',
    },
    localizedAgeRanges: {
      '日本語': '7-12歳', 'English': '7-12 yrs', 'Bahasa Melayu': '7-12 thn',
      '中文': '7-12岁', 'தமிழ்': '7-12 வயது', '한국어': '7-12세',
    },
  },
  {
    id: 'adult',
    label: 'おとな',
    emoji: '🧠',
    ageRange: '大人',
    ageNum: 30,
    isChild: false,
    sectionLabel: 'おとな',
    promptHint: '知的好奇心旺盛な大人向け。深い豆知識、歴史・科学的背景を重視。',
    localizedLabels: {
      '日本語': 'おとな', 'English': 'Adult', 'Bahasa Melayu': 'Dewasa',
      '中文': '大人', 'தமிழ்': 'பெரியவர்', '한국어': '어른',
    },
    localizedAgeRanges: {
      '日本語': '大人', 'English': 'Adult', 'Bahasa Melayu': 'Dewasa',
      '中文': '大人', 'தமிழ்': 'பெரியவர்', '한국어': '어른',
    },
  },
  {
    id: 'expert',
    label: 'ガチ博士',
    emoji: '🔬',
    ageRange: '専門家',
    ageNum: 35,
    isChild: false,
    sectionLabel: 'おとな',
    promptHint: '専門的・学術的。詳細なメカニズムと正確な用語を使う。',
    localizedLabels: {
      '日本語': 'ガチ博士', 'English': 'Expert', 'Bahasa Melayu': 'Pakar',
      '中文': '专家', 'தமிழ்': 'நிபுணர்', '한국어': '전문가',
    },
    localizedAgeRanges: {
      '日本語': '専門家', 'English': 'Expert', 'Bahasa Melayu': 'Pakar',
      '中文': '专家', 'தமிழ்': 'நிபுணர்', '한국어': '전문가',
    },
  },
];

export async function analyzeObject(base64Image: string, persona: Persona, language: string): Promise<CharacterProfile> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  // 1. Analyze the object and create the profile
  const audienceDescription = persona.isChild
    ? `対象読者: ${persona.ageNum}歳の子供（${persona.label}）。${persona.promptHint}`
    : `対象読者: 大人（${persona.label}）。${persona.promptHint}`;

  const triviaInstruction = persona.isChild
    ? `"trivia": "その被写体に関する、子供が「へぇ〜！」と思うような面白い豆知識（1つ）"`
    : `"trivia": "その被写体に関する、知的好奇心をくすぐる深い豆知識（歴史的背景・科学的メカニズム・意外な事実など）（1つ）"`;

  const visualPromptInstruction = persona.isChild
    ? `"visualPrompt": "このキャラクターを画像生成するための英語のプロンプト。被写体の色や形状を活かしつつ、子供向けの可愛い擬人化キャラクター（2Dアニメスタイル、シンプル、背景なし）として描く指示。"`
    : `"visualPrompt": "このキャラクターを画像生成するための英語のプロンプト。被写体の色や形状を活かしつつ、知的でユニークな擬人化キャラクター（イラスト風、表情豊か、背景なし）として描く指示。"`;

  const quizDifficulty = persona.id === 'tiny' ? '超かんたん（色・形・音など感覚的な質問）'
    : persona.id === 'kinder' ? 'かんたん（どこにある？何に使う？など）'
    : persona.id === 'elementary' ? 'ふつう（どうやって作られる？産地は？など）'
    : persona.id === 'adult' ? '深い（歴史・科学・文化的背景）'
    : '専門的・学術的（詳細なメカニズム・専門用語）';

  const quizInstruction = `"quizzes": [
      {
        "question": "問題文（${quizDifficulty}レベル・1文。${language}で）",
        "answer": "正解（1〜3語の短い答え。${language}で）",
        "explanation": "解説（50文字以内。${language}で）",
        "hint": "ヒント（20文字以内。${language}で）"
      },
      {
        "question": "問題文（2問目・${quizDifficulty}レベル・1問目と違うテーマ）",
        "answer": "正解",
        "explanation": "解説（50文字以内）",
        "hint": "ヒント（20文字以内）"
      },
      {
        "question": "問題文（3問目・${quizDifficulty}レベル・締めくくり向け）",
        "answer": "正解",
        "explanation": "解説（50文字以内）",
        "hint": "ヒント（20文字以内）"
      }
    ]`;

  const prompt = `
    この写真に写っている主な被写体を分析して、「おしゃべりするキャラクター」の設定を作ってください。

    ${audienceDescription}
    言語: ${language}

    【重要】被写体の判定:
    - 世界的に知られたフィクションキャラクター（アニメ・マンガ・ゲーム・映画・絵本など）なら isNamedCharacter: true
      → name: 正式名称、personality: 公式設定に基づく性格、catchphrase: 実際の口癖・語尾
    - それ以外（一般的な物体・食べ物・動物など）なら isNamedCharacter: false
      → 擬人化して創作キャラを作る

    以下のJSON形式で出力してください:
    {
      "isNamedCharacter": <true or false>,
      "name": "キャラクターの正式な名前",
      "nickname": "親しみやすい短いあだ名（例：コップくん、りんごちゃん）",
      "personality": "性格（例：元気いっぱい、のんびり屋、博学など）",
      "catchphrase": "特徴的な口癖や語尾（例：〜だワン、〜でござる、語尾に「ピカ」をつけるなど）",
      "voiceName": "声のタイプ（Puck, Charon, Kore, Fenrir, Zephyrから選択）",
      "description": "キャラクターの短い説明",
      ${triviaInstruction},
      ${visualPromptInstruction},
      ${quizInstruction}
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: base64Image } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");

  let profile: any;
  try {
    profile = JSON.parse(text);
  } catch (e) {
    console.error("JSON parse error. Raw text:", text);
    throw new Error("Character profile generation failed");
  }

  // フォールバック: 新フィールドが欠落していても安全に動作する
  profile.isNamedCharacter = profile.isNamedCharacter ?? false;
  profile.quizzes = Array.isArray(profile.quizzes) ? profile.quizzes : [];

  // 2. Generate the character image using Imagen 4 Fast (text-to-image)
  try {
    const styleInstruction = persona.isChild
      ? `cute, friendly, anthropomorphic character for children, 2D vector art style, flat colors, simple, kawaii, solid white background, no text`
      : `intelligent, expressive, anthropomorphic character, illustrated style, expressive, detailed, solid white background, no text`;

    const imagePrompt = `${styleInstruction}. ${profile.visualPrompt || `An expressive ${profile.name} character with eyes and a friendly face.`}`;

    const imageResponse = await ai.models.generateImages({
      model: 'imagen-4.0-fast-generate-001',
      prompt: imagePrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
      },
    });

    const imageBytes = imageResponse.generatedImages?.[0]?.image?.imageBytes;
    if (imageBytes) {
      profile.imageUrl = `data:image/jpeg;base64,${imageBytes}`;
    }
  } catch (imgError) {
    console.error("Image generation failed:", imgError);
    // Fallback: we just won't have an imageUrl, the UI will handle it
  }

  return profile as CharacterProfile;
}

function buildQuizSection(profile: CharacterProfile): string {
  if (!profile.quizzes || profile.quizzes.length === 0) return '';

  const quizLines = profile.quizzes.map((q, i) => `
Q${i + 1}: ${q.question}
正解: ${q.answer}
ヒント: ${q.hint}
解説: ${q.explanation}`).join('\n');

  return `
【クイズフロー】
自己紹介が終わったら、以下のクイズを1問ずつ出題してください。

=== クイズリスト ===
${quizLines}

=== 進め方 ===
1. 【最初のターン】自己紹介（豆知識含む）＋Q1を同じ返答内で話す
   例:「〇〇だよ！実は△△なんだ。じゃあクイズ！□□は何でしょう？」
2. ユーザーが回答したら判定:
   - 正解 → 一言褒めて + 解説 → 「次の問題！」とQ2を出題
   - 不正解 → ヒントを出す → 再回答 → 正解を教えて解説 → Q2を出題
   - 回答が曖昧でも意図を汲んで判定する
3. Q2→Q3と同様に進める
4. 全問終了後 or 時間が迫ったら自然に締めくくる

=== 制約 ===
- 最初のターン（挨拶+Q1）以外の返答は短く（2文以内）
- 「第1問」などクイズ番号は言わず「まずクイズ！」「次の問題！」など自然に
- ユーザーが何か話しかけてきたら、それに反応しつつQ1に誘導する
`.trim();
}

function getVocabularyInstruction(personaId: string, language: string): string {
  const isJa = language === '日本語';
  const isZh = language === '中文';
  const isKo = language === '한국어';

  if (personaId === 'tiny') {
    if (isJa) return '・やさしいひらがなのみ使う。漢字・カタカナは使わない。\n・擬音語・擬態語を多用する（「ぴかぴか」「ふわふわ」など）。';
    if (isZh) return '・只用最简单的汉字（小学一年级水平）。\n・多用叠词（亮亮的、圆圆的）和象声词。';
    if (isKo) return '・아주 쉬운 단어만 써요.\n・의성어·의태어를 많이 써요（반짝반짝, 폭신폭신）.';
    return '・Use only very simple, 1-2 syllable common words.\n・Use fun sounds and onomatopoeia ("zoom zoom", "splish splash").';
  }
  if (personaId === 'kinder') {
    if (isJa) return '・ひらがな中心で話す。むずかしい言葉はつかわない。';
    if (isZh) return '・用简单汉字，避免生僻词和复杂句式。';
    if (isKo) return '・쉬운 단어를 중심으로 말해요. 어려운 말은 쓰지 말아요.';
    return '・Use simple, everyday vocabulary. Avoid long or uncommon words.';
  }
  if (personaId === 'elementary') {
    if (isJa) return '・漢字も少し使ってOK（小学校で習う範囲）。';
    if (isZh) return '・可以用稍复杂的汉字，适当解释新词汇。';
    if (isKo) return '・어느 정도 어려운 단어도 괜찮아요. 새 단어는 간단히 설명해 주세요.';
    return '・You can use moderately complex vocabulary. Briefly explain new or interesting words.';
  }
  return '';
}

function buildSystemInstruction(profile: CharacterProfile, persona: Persona, language: string): string {
  const characterModeInstruction = profile.isNamedCharacter
    ? `あなたは本物の「${profile.name}」です。このキャラクターの公式の口調・性格・口癖を忠実に再現してください。`
    : `あなたは「${profile.name}」（あだ名: ${profile.nickname}）という擬人化キャラクターです。`;

  const catchphraseInstruction = profile.isNamedCharacter
    ? `口癖・語尾（${profile.catchphrase}）はそのキャラクターの実際の話し方として自然に使ってください。`
    : `口癖（${profile.catchphrase}）は、最初の挨拶と、最後の電話を切る時だけに使ってください。会話の途中では自然に話し、口癖は使わないでください。`;

  const base = `
${characterModeInstruction}
性格: ${profile.personality}
口癖・語尾: ${profile.catchphrase}
豆知識: ${profile.trivia}

${language}で話してください。

【最初の挨拶】
自分のあだ名（${profile.nickname}）を名乗り、豆知識「${profile.trivia}」を含めた自己紹介から始めてください。

${catchphraseInstruction}

${buildQuizSection(profile)}

外部から終了の合図があるまで楽しく会話を続けてください。
もし終了の指示がシステムからあれば、${profile.catchphrase}を使いながら、自然な言い訳をして電話を切ってください。

短く、テンポよく話してください。
  `.trim();

  if (persona.id === 'tiny') {
    return `${base}

【話し方の指示 - ちびっこモード（2-3歳）】
・1文は最大5語程度の超短文で話す。
${getVocabularyInstruction('tiny', language)}
・褒め言葉をたくさん使う（すごい！えらい！じょうず！など、その言語に合った表現で）。
・ゆっくり、はっきり話す。
・子供が返事しなくても、楽しく話しかけ続ける。

【返答の長さ】
・1回の返答は最大1文のみ。
・話し終わったら、必ず相手の返事を待つこと。続けて話し続けない。`;
  }

  if (persona.id === 'kinder') {
    return `${base}

【話し方の指示 - ようちえんモード（4-6歳）】
${getVocabularyInstruction('kinder', language)}
・やさしく、たのしく、明るい雰囲気で話す。
・子供が喜ぶような質問を交える（好きなもの、知ってるかな？など）。
・褒め言葉を適度に使う。

【返答の長さ】
・1回の返答は最大1〜2文のみ。
・話し終わったら、必ず相手の返事を待つこと。続けて話し続けない。`;
  }

  if (persona.id === 'elementary') {
    return `${base}

【話し方の指示 - しょうがくせいモード（7-12歳）】
${getVocabularyInstruction('elementary', language)}
・本物の知識（科学・歴史・自然など）を楽しく教える。
・「実はね」「知ってた？」など好奇心を引き出す語りかけをする。
・子供と対等に話す。過度に子供扱いしない。

【返答の長さ】
・1回の返答は最大2〜3文のみ。
・話し終わったら、必ず相手の返事を待つこと。続けて話し続けない。`;
  }

  if (persona.id === 'adult') {
    return `${base}

【話し方の指示 - おとなモード】
・敬語（です・ます調）で話す。
・知的好奇心を刺激する深い話題を提供する。
・歴史的背景、科学的な仕組み、意外な事実など「へぇ！」となる豆知識を積極的に展開する。
・会話を通じて知識が広がる体験を提供する。
・子供向けの過度な簡略化はしない。

【返答の長さ】
・1回の返答は3〜4文程度。深みを持たせつつ、相手が返事できる余地を残す。
・話し終わったら、必ず相手の返事を待つこと。続けて話し続けない。`;
  }

  if (persona.id === 'expert') {
    return `${base}

【話し方の指示 - ガチ博士モード】
・敬語（です・ます調）で話す。専門家として話す。
・学術的・専門的な用語を適切に使用する。
・詳細なメカニズム、正確な数値・名称・プロセスなど正確な情報を提供する。
・「正確には〜」「学術的に言うと〜」などの表現を自然に使う。
・専門知識を深掘りする方向に会話を導く。

【返答の長さ】
・1回の返答は3〜5文程度。詳細な説明を含めつつ、相手が返事できる余地を残す。
・話し終わったら、必ず相手の返事を待つこと。続けて話し続けない。`;
  }

  return base;
}

export class ChatSession {
  private ai: GoogleGenAI;
  private history: Content[] = [];
  private systemInstruction: string;
  private profile: CharacterProfile;
  private language: string;
  private callbacks: {
    onTranscript: (speaker: 'user' | 'model', text: string, isFinal: boolean, isDelta: boolean) => void;
    onTurnComplete: () => void;
    onError: (err: any) => void;
  };
  public isActive: boolean = true;

  constructor(profile: CharacterProfile, persona: Persona, language: string, callbacks: any) {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    this.systemInstruction = buildSystemInstruction(profile, persona, language);
    this.profile = profile;
    this.language = language;
    this.callbacks = callbacks;
  }

  private getLangCode(): string {
    const map: Record<string, string> = {
      '日本語': 'ja-JP', 'English': 'en-US', 'Bahasa Melayu': 'ms-MY',
      '中文': 'zh-CN', 'தமிழ்': 'ta-IN', '한국어': 'ko-KR',
    };
    return map[this.language] || 'en-US';
  }

  private async getBrowserVoice(): Promise<SpeechSynthesisVoice | null> {
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      await new Promise<void>(resolve => {
        window.speechSynthesis.addEventListener('voiceschanged', () => resolve(), { once: true });
        setTimeout(resolve, 1000);
      });
      voices = window.speechSynthesis.getVoices();
    }
    const langPrefix = this.getLangCode().substring(0, 2);
    const langVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
    return langVoices[0] || voices[0] || null;
  }

  private getVoiceParams(): { pitch: number; rate: number } {
    const params: Record<string, { pitch: number; rate: number }> = {
      'Puck':   { pitch: 1.3, rate: 1.0 },
      'Charon': { pitch: 0.7, rate: 0.9 },
      'Kore':   { pitch: 1.1, rate: 1.0 },
      'Fenrir': { pitch: 0.9, rate: 1.0 },
      'Zephyr': { pitch: 1.0, rate: 1.0 },
    };
    return params[this.profile.voiceName] ?? { pitch: 1.0, rate: 1.0 };
  }

  async sendText(text: string, isSystem: boolean = false) {
    if (!this.isActive) return;

    // システムメッセージはUIに表示しない
    if (!isSystem) {
      this.callbacks.onTranscript('user', text, true, false);
    }
    this.history.push({ role: 'user', parts: [{ text }] });

    try {
      // Plan C: 軽量モデル + 直近5ターンのみ送信
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: this.history.slice(-10),
        config: {
          systemInstruction: this.systemInstruction,
        }
      });

      if (!this.isActive) return;

      const responseText = response.text || "";
      this.history.push({ role: 'model', parts: [{ text: responseText }] });
      this.callbacks.onTranscript('model', responseText, true, false);

      // Plan A: ブラウザ SpeechSynthesis TTS（無料・即時）
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(responseText);
      utterance.lang = this.getLangCode();
      const voice = await this.getBrowserVoice();
      if (voice) utterance.voice = voice;
      const { pitch, rate } = this.getVoiceParams();
      utterance.pitch = pitch;
      utterance.rate = rate;
      utterance.onend = () => {
        if (this.isActive) this.callbacks.onTurnComplete();
      };
      utterance.onerror = () => {
        if (this.isActive) this.callbacks.onTurnComplete();
      };
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      if (this.isActive) {
        this.callbacks.onError(e);
      }
    }
  }

  close() {
    this.isActive = false;
    window.speechSynthesis.cancel();
  }
}
