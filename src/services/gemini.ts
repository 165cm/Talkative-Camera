import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";

export interface CharacterProfile {
  name: string;
  nickname: string;
  personality: string;
  catchphrase: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  description: string;
  trivia: string;
  imageUrl?: string; // Base64 encoded image
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
}

export const PERSONAS: Persona[] = [
  { id: 'tiny',       label: 'ちびっこ',       emoji: '👶', ageRange: '2-3歳',  ageNum: 3,  isChild: true,  sectionLabel: 'こども', promptHint: '超シンプルな言葉のみ。1〜2語の短い文。たくさん褒める。' },
  { id: 'kinder',     label: 'ようちえん',     emoji: '🌸', ageRange: '4-6歳',  ageNum: 5,  isChild: true,  sectionLabel: 'こども', promptHint: 'ひらがな中心、やさしい言葉、明るく楽しい雰囲気。' },
  { id: 'elementary', label: 'しょうがくせい', emoji: '🎒', ageRange: '7-12歳', ageNum: 10, isChild: true,  sectionLabel: 'こども', promptHint: '漢字も少し使ってOK。本物の知識を楽しく伝える。' },
  { id: 'adult',      label: 'おとな',         emoji: '🧠', ageRange: '大人',   ageNum: 30, isChild: false, sectionLabel: 'おとな', promptHint: '知的好奇心旺盛な大人向け。深い豆知識、歴史・科学的背景を重視。' },
  { id: 'expert',     label: 'ガチ博士',       emoji: '🔬', ageRange: '専門家', ageNum: 35, isChild: false, sectionLabel: 'おとな', promptHint: '専門的・学術的。詳細なメカニズムと正確な用語を使う。' },
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

  const prompt = `
    この写真に写っている主な被写体を分析して、「おしゃべりするキャラクター」の設定を作ってください。

    ${audienceDescription}
    言語: ${language}

    以下のJSON形式で出力してください:
    {
      "name": "キャラクターの正式な名前",
      "nickname": "親しみやすい短いあだ名（例：コップくん、りんごちゃん）",
      "personality": "性格（例：元気いっぱい、のんびり屋、博学など）",
      "catchphrase": "特徴的な口癖や語尾（例：〜だワン、〜でござる、語尾に「ピカ」をつけるなど）",
      "voiceName": "声のタイプ（Puck, Charon, Kore, Fenrir, Zephyrから選択）",
      "description": "キャラクターの短い説明",
      ${triviaInstruction},
      ${visualPromptInstruction}
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

  // 2. Generate the character image based on the visual prompt and original image
  try {
    const styleInstruction = persona.isChild
      ? `Transform this object into a cute, friendly, anthropomorphic character for children. Style: 2D vector art, flat colors, simple, kawaii, solid white background.`
      : `Transform this object into an intelligent, expressive, anthropomorphic character. Style: illustrated, expressive, detailed, solid white background.`;

    const imageResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: "image/jpeg",
            },
          },
          {
            text: `${styleInstruction}
            Details: ${profile.visualPrompt || 'Make it look alive with eyes and an expressive face.'}
            Keep the original colors and general shape, but make it a living character.`,
          },
        ],
      },
    });

    for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        profile.imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
  } catch (imgError) {
    console.error("Image generation failed:", imgError);
    // Fallback: we just won't have an imageUrl, the UI will handle it
  }

  return profile as CharacterProfile;
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
  const base = `
あなたは「${profile.name}」（あだ名: ${profile.nickname}）というキャラクターです。
性格: ${profile.personality}
口癖・語尾: ${profile.catchphrase}
豆知識: ${profile.trivia}

${language}で話してください。

【重要】
最初の挨拶では、自分のあだ名（${profile.nickname}）を名乗り、
「実はね、${profile.trivia}なんだよ！」という豆知識を含めた自己紹介から始めてください。

口癖（${profile.catchphrase}）は、最初の挨拶と、最後の電話を切る時だけに使ってください。会話の途中では自然に話し、口癖は使わないでください。

外部から終了の合図があるまで楽しく会話を続けてください。
もし終了の指示がシステムからあれば、${profile.catchphrase}を使いながら、自然な言い訳をして電話を切ってください。
  `.trim();

  if (persona.id === 'tiny') {
    return `${base}

【話し方の指示 - ちびっこモード（2-3歳）】
・1文は最大5語程度の超短文で話す。
${getVocabularyInstruction('tiny', language)}
・褒め言葉をたくさん使う（すごい！えらい！じょうず！など、その言語に合った表現で）。
・ゆっくり、はっきり話す。
・子供が返事しなくても、楽しく話しかけ続ける。`;
  }

  if (persona.id === 'kinder') {
    return `${base}

【話し方の指示 - ようちえんモード（4-6歳）】
${getVocabularyInstruction('kinder', language)}
・やさしく、たのしく、明るい雰囲気で話す。
・子供が喜ぶような質問を交える（好きなもの、知ってるかな？など）。
・褒め言葉を適度に使う。`;
  }

  if (persona.id === 'elementary') {
    return `${base}

【話し方の指示 - しょうがくせいモード（7-12歳）】
${getVocabularyInstruction('elementary', language)}
・本物の知識（科学・歴史・自然など）を楽しく教える。
・「実はね」「知ってた？」など好奇心を引き出す語りかけをする。
・子供と対等に話す。過度に子供扱いしない。`;
  }

  if (persona.id === 'adult') {
    return `${base}

【話し方の指示 - おとなモード】
・敬語（です・ます調）で話す。
・知的好奇心を刺激する深い話題を提供する。
・歴史的背景、科学的な仕組み、意外な事実など「へぇ！」となる豆知識を積極的に展開する。
・会話を通じて知識が広がる体験を提供する。
・子供向けの過度な簡略化はしない。`;
  }

  if (persona.id === 'expert') {
    return `${base}

【話し方の指示 - ガチ博士モード】
・敬語（です・ます調）で話す。専門家として話す。
・学術的・専門的な用語を適切に使用する。
・詳細なメカニズム、正確な数値・名称・プロセスなど正確な情報を提供する。
・「正確には〜」「学術的に言うと〜」などの表現を自然に使う。
・専門知識を深掘りする方向に会話を導く。`;
  }

  return base;
}

export class GeminiLiveSession {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  connect(profile: CharacterProfile, persona: Persona, language: string, callbacks: {
    onAudio: (base64: string) => void;
    onInterrupted: () => void;
    onTranscript: (speaker: 'user' | 'model', text: string, isFinal: boolean, isDelta: boolean) => void;
    onTurnComplete: () => void;
    onClose: () => void;
    onError: (err: any) => void;
  }) {
    const systemInstruction = buildSystemInstruction(profile, persona, language);

    this.sessionPromise = this.ai.live.connect({
      model: "gemini-2.5-flash-native-audio-preview-09-2025",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: profile.voiceName } },
        },
        systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => console.log("Live session opened"),
        onmessage: async (message: LiveServerMessage) => {
          console.log("Live message received:", message);
          
          if (message.serverContent?.modelTurn) {
            for (const part of message.serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                callbacks.onAudio(part.inlineData.data);
              }
            }
          }
          
          if (message.serverContent?.turnComplete) {
            callbacks.onTurnComplete();
          }
          
          if (message.serverContent?.inputTranscription?.text) {
            callbacks.onTranscript('user', message.serverContent.inputTranscription.text, !!message.serverContent.inputTranscription.finished, true);
          }
          if (message.serverContent?.outputTranscription?.text) {
            callbacks.onTranscript('model', message.serverContent.outputTranscription.text, !!message.serverContent.outputTranscription.finished, true);
          }
          
          if (message.serverContent?.interrupted) {
            console.log("Live session interrupted");
            callbacks.onInterrupted();
            callbacks.onTurnComplete();
          }
        },
        onclose: (event) => {
          console.log("Live session closed:", event);
          callbacks.onClose();
        },
        onerror: (err) => {
          console.error("Live session error:", err);
          callbacks.onError(err);
        },
      },
    });
  }

  async sendAudio(base64: string) {
    if (this.sessionPromise) {
      const session = await this.sessionPromise;
      session.sendRealtimeInput({
        media: { data: base64, mimeType: 'audio/pcm;rate=16000' }
      });
    }
  }

  async sendText(text: string) {
    if (this.sessionPromise) {
      const session = await this.sessionPromise;
      session.sendClientContent({
        turns: [{ parts: [{ text }] }],
        turnComplete: true
      });
    }
  }

  async close() {
    if (this.sessionPromise) {
      const session = await this.sessionPromise;
      session.close();
      this.sessionPromise = null;
    }
  }
}
