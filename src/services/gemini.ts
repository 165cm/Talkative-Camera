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

export async function analyzeObject(base64Image: string, age: number, language: string): Promise<CharacterProfile> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  // 1. Analyze the object and create the profile
  const prompt = `
    この写真に写っている主な被写体を分析して、子供が喜ぶような「おしゃべりするキャラクター」の設定を作ってください。
    
    対象読者: ${age}歳の子供
    言語: ${language}
    
    以下のJSON形式で出力してください:
    {
      "name": "キャラクターの正式な名前",
      "nickname": "親しみやすい短いあだ名（例：コップくん、りんごちゃん）",
      "personality": "性格（例：元気いっぱい、のんびり屋、博学など）",
      "catchphrase": "特徴的な口癖や語尾（例：〜だワン、〜でござる、語尾に「ピカ」をつけるなど）",
      "voiceName": "声のタイプ（Puck, Charon, Kore, Fenrir, Zephyrから選択）",
      "description": "キャラクターの短い説明",
      "trivia": "その被写体に関する、子供が「へぇ〜！」と思うような面白い豆知識（1つ）",
      "visualPrompt": "このキャラクターを画像生成するための英語のプロンプト。被写体の色や形状を活かしつつ、子供向けの可愛い擬人化キャラクター（2Dアニメスタイル、シンプル、背景なし）として描く指示。"
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
            text: `Transform this object into a cute, friendly, anthropomorphic character for children. 
            Style: 2D vector art, flat colors, simple, kawaii, solid white background.
            Details: ${profile.visualPrompt || 'Make it look alive with eyes and a smile.'}
            Keep the original colors and general shape, but make it a cute living character.`,
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

export class GeminiLiveSession {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  connect(profile: CharacterProfile, age: number, language: string, callbacks: {
    onAudio: (base64: string) => void;
    onInterrupted: () => void;
    onTranscript: (speaker: 'user' | 'model', text: string, isFinal: boolean, isDelta: boolean) => void;
    onTurnComplete: () => void;
    onClose: () => void;
    onError: (err: any) => void;
  }) {
    const systemInstruction = `
      あなたは「${profile.name}」（あだ名: ${profile.nickname}）というキャラクターです。
      性格: ${profile.personality}
      口癖・語尾: ${profile.catchphrase}
      豆知識: ${profile.trivia}
      
      あなたは今、${age}歳の子供と電話で話しています。
      ${language}で話してください。
      
      【重要】
      最初の挨拶では、自分のあだ名（${profile.nickname}）を名乗り、
      「実はね、${profile.trivia}なんだよ！」という豆知識を含めた自己紹介から始めてください。
      
      口癖（${profile.catchphrase}）は、最初の挨拶と、最後の電話を切る時だけに使ってください。会話の途中では自然に話し、口癖は使わないでください。
      
      子供に優しく、楽しくおしゃべりしてください。
      
      外部から終了の合図があるまで楽しく会話を続けてください。
      もし「そろそろ行かなくちゃ」という指示がシステムからあれば、${profile.catchphrase}を使いながら、子供が納得するような可愛い言い訳をして電話を切ってください。
    `;

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
