/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LangCode = 'ja' | 'en' | 'ms' | 'zh' | 'ta' | 'ko';

export type TranslationKey =
  // Language selection screen
  | 'langScreen.title'
  | 'langScreen.subtitle'
  // Setup screen
  | 'setup.title'
  | 'setup.subtitle'
  | 'setup.whoLabel'
  | 'setup.sectionKids'
  | 'setup.sectionAdult'
  | 'setup.languageLabel'
  | 'setup.changeLanguage'
  | 'setup.startButton'
  | 'setup.limitReached'
  // Camera screen
  | 'camera.hint'
  // Analyzing screen
  | 'analyzing.loading.title'
  | 'analyzing.loading.subtitle'
  | 'analyzing.error.title'
  | 'analyzing.error.subtitle'
  // Incoming screen
  | 'incoming.calling'
  | 'incoming.triviaLabel'
  // Talking screen
  | 'talking.withCharacter'
  // Ended screen
  | 'ended.goodbye'
  | 'ended.messageChild'
  | 'ended.messageAdult'
  | 'ended.playAgain'
  // System messages sent to Gemini as instructions
  | 'system.timeUpChild'
  | 'system.timeUpAdult'
  | 'system.greetAndQuiz';

type Translations = Record<LangCode, Record<TranslationKey, string>>;

export const translations: Translations = {
  ja: {
    'langScreen.title': '言語を選んでください',
    'langScreen.subtitle': 'Choose your language',
    'setup.title': 'おしゃべりカメラ',
    'setup.subtitle': 'モノと電話でお話ししよう！',
    'setup.whoLabel': 'だれが使う？',
    'setup.sectionKids': '👦 こども',
    'setup.sectionAdult': '🧑 おとな',
    'setup.languageLabel': 'ことば',
    'setup.changeLanguage': '変更',
    'setup.startButton': 'はじめる！',
    'setup.limitReached': '本日の上限に達しました',
    'camera.hint': 'すきなものをうつしてね',
    'analyzing.loading.title': 'だれかな？',
    'analyzing.loading.subtitle': 'まほうをかけちゅう...',
    'analyzing.error.title': 'あれ〜！',
    'analyzing.error.subtitle': 'もういちどとってみてね！',
    'incoming.calling': 'でんわがかかってきたよ！',
    'incoming.triviaLabel': 'まめちしき：',
    'talking.withCharacter': 'とはなしちゅう',
    'ended.goodbye': 'またね！',
    'ended.messageChild': '{name}とおしゃべりできたね！',
    'ended.messageAdult': '{name}との会話、楽しめましたか？',
    'ended.playAgain': 'もういちどあそぶ！',
    'system.timeUpChild': 'そろそろ電話を切る時間です。子供にバイバイと言って、可愛い言い訳をして電話を切ってください。',
    'system.timeUpAdult': 'そろそろ電話を切る時間です。会話を自然に締めくくり、別れの挨拶をして電話を切ってください。',
    'system.greetAndQuiz': '会話を始めてください。自己紹介をして、そのままクイズの1問目を出題してください。',
  },
  en: {
    'langScreen.title': 'Choose Language',
    'langScreen.subtitle': '言語を選んでください',
    'setup.title': 'Talkative Camera',
    'setup.subtitle': "Let's chat with things around you!",
    'setup.whoLabel': "Who's playing?",
    'setup.sectionKids': '👦 Kids',
    'setup.sectionAdult': '🧑 Adults',
    'setup.languageLabel': 'Language',
    'setup.changeLanguage': 'Change',
    'setup.startButton': "Let's Go!",
    'setup.limitReached': "Today's limit reached",
    'camera.hint': 'Point at something you like!',
    'analyzing.loading.title': 'Who could this be?',
    'analyzing.loading.subtitle': 'Casting a magic spell...',
    'analyzing.error.title': 'Oops!',
    'analyzing.error.subtitle': 'Try taking another photo!',
    'incoming.calling': 'Incoming call!',
    'incoming.triviaLabel': 'Fun fact: ',
    'talking.withCharacter': 'talking with',
    'ended.goodbye': 'Bye bye!',
    'ended.messageChild': 'Great chatting with {name}!',
    'ended.messageAdult': 'Did you enjoy talking with {name}?',
    'ended.playAgain': 'Play Again!',
    'system.timeUpChild': "It's time to hang up. Say a cute goodbye to the child with a fun excuse and end the call.",
    'system.timeUpAdult': "It's time to wrap up. Conclude the conversation naturally and say your farewells.",
    'system.greetAndQuiz': 'Please start the conversation. Introduce yourself and immediately ask Quiz Question 1.',
  },
  ms: {
    'langScreen.title': 'Pilih Bahasa',
    'langScreen.subtitle': '言語を選んでください',
    'setup.title': 'Kamera Bercakap',
    'setup.subtitle': 'Mari berbual dengan benda-benda!',
    'setup.whoLabel': 'Siapa yang bermain?',
    'setup.sectionKids': '👦 Kanak-kanak',
    'setup.sectionAdult': '🧑 Dewasa',
    'setup.languageLabel': 'Bahasa',
    'setup.changeLanguage': 'Tukar',
    'setup.startButton': 'Mulakan!',
    'setup.limitReached': 'Had hari ini dicapai',
    'camera.hint': 'Arahkan ke sesuatu yang anda suka!',
    'analyzing.loading.title': 'Siapakah ini?',
    'analyzing.loading.subtitle': 'Sedang membuat sihir...',
    'analyzing.error.title': 'Alamak!',
    'analyzing.error.subtitle': 'Cuba ambil gambar lagi!',
    'incoming.calling': 'Ada panggilan masuk!',
    'incoming.triviaLabel': 'Fakta menarik: ',
    'talking.withCharacter': 'bercakap dengan',
    'ended.goodbye': 'Jumpa lagi!',
    'ended.messageChild': 'Seronok bercakap dengan {name}!',
    'ended.messageAdult': 'Adakah anda seronok bercakap dengan {name}?',
    'ended.playAgain': 'Main Lagi!',
    'system.timeUpChild': 'Sudah tiba masanya untuk menutup telefon. Ucap selamat tinggal kepada kanak-kanak dengan alasan yang comel.',
    'system.timeUpAdult': 'Sudah tiba masanya untuk mengakhiri perbualan. Tutup dengan semula jadi dan ucap selamat tinggal.',
    'system.greetAndQuiz': 'Sila mulakan perbualan. Perkenalkan diri anda dan terus tanya Soalan Kuiz 1.',
  },
  zh: {
    'langScreen.title': '选择语言',
    'langScreen.subtitle': '言語を選んでください',
    'setup.title': '会说话的相机',
    'setup.subtitle': '和身边的东西打电话吧！',
    'setup.whoLabel': '谁在使用？',
    'setup.sectionKids': '👦 小朋友',
    'setup.sectionAdult': '🧑 大人',
    'setup.languageLabel': '语言',
    'setup.changeLanguage': '更改',
    'setup.startButton': '开始！',
    'setup.limitReached': '今日次数已达上限',
    'camera.hint': '拍一张你喜欢的东西！',
    'analyzing.loading.title': '这是谁呀？',
    'analyzing.loading.subtitle': '正在施魔法...',
    'analyzing.error.title': '哎呀！',
    'analyzing.error.subtitle': '再试一次吧！',
    'incoming.calling': '来电话啦！',
    'incoming.triviaLabel': '小知识：',
    'talking.withCharacter': '正在与{name}通话',
    'ended.goodbye': '再见！',
    'ended.messageChild': '和{name}聊得开心吧！',
    'ended.messageAdult': '和{name}的对话愉快吗？',
    'ended.playAgain': '再玩一次！',
    'system.timeUpChild': '是时候挂电话了。向孩子说再见，用可爱的借口结束通话。',
    'system.timeUpAdult': '是时候结束对话了。自然地收尾并道别。',
    'system.greetAndQuiz': '请开始对话。先介绍自己，然后立即提出测验第一题。',
  },
  ta: {
    'langScreen.title': 'மொழியை தேர்ந்தெடுங்கள்',
    'langScreen.subtitle': '言語を選んでください',
    'setup.title': 'பேசும் கேமரா',
    'setup.subtitle': 'பொருட்களுடன் பேசுங்கள்!',
    'setup.whoLabel': 'யார் விளையாடுகிறார்கள்?',
    'setup.sectionKids': '👦 குழந்தைகள்',
    'setup.sectionAdult': '🧑 பெரியவர்கள்',
    'setup.languageLabel': 'மொழி',
    'setup.changeLanguage': 'மாற்று',
    'setup.startButton': 'தொடங்கு!',
    'setup.limitReached': 'இன்றைய வரம்பு எட்டிவிட்டது',
    'camera.hint': 'விரும்பும் பொருளை படமெடுங்கள்!',
    'analyzing.loading.title': 'இது யார்?',
    'analyzing.loading.subtitle': 'மந்திரம் செய்கிறோம்...',
    'analyzing.error.title': 'அச்சோ!',
    'analyzing.error.subtitle': 'மீண்டும் முயற்சிக்கவும்!',
    'incoming.calling': 'அழைப்பு வருகிறது!',
    'incoming.triviaLabel': 'சுவாரஸ்யம்: ',
    'talking.withCharacter': '{name} உடன் பேசுகிறோம்',
    'ended.goodbye': 'வருகிறேன்!',
    'ended.messageChild': '{name} உடன் பேசினோம்!',
    'ended.messageAdult': '{name} உடன் அரட்டை அடித்தீர்களா?',
    'ended.playAgain': 'மீண்டும் விளையாடு!',
    'system.timeUpChild': 'இப்போது தொலைபேசியை வைக்கும் நேரம். குழந்தைக்கு அழகாக விடைபெற்று அழைப்பை முடிக்கவும்.',
    'system.timeUpAdult': 'உரையாடலை முடிக்கும் நேரம். இயல்பாக முடித்து விடைபெறவும்.',
    'system.greetAndQuiz': 'உரையாடலை தொடங்கவும். உங்களை அறிமுகப்படுத்திக்கொண்டு உடனே முதல் வினாடி வினாவை கேளுங்கள்.',
  },
  ko: {
    'langScreen.title': '언어를 선택하세요',
    'langScreen.subtitle': '言語を選んでください',
    'setup.title': '말하는 카메라',
    'setup.subtitle': '물건과 전화로 이야기해요!',
    'setup.whoLabel': '누가 놀 건가요?',
    'setup.sectionKids': '👦 어린이',
    'setup.sectionAdult': '🧑 어른',
    'setup.languageLabel': '언어',
    'setup.changeLanguage': '변경',
    'setup.startButton': '시작하기!',
    'setup.limitReached': '오늘 사용 한도에 도달했어요',
    'camera.hint': '좋아하는 것을 찍어요!',
    'analyzing.loading.title': '누구일까요?',
    'analyzing.loading.subtitle': '마법을 걸고 있어요...',
    'analyzing.error.title': '앗!',
    'analyzing.error.subtitle': '다시 찍어봐요!',
    'incoming.calling': '전화가 왔어요!',
    'incoming.triviaLabel': '재미있는 사실: ',
    'talking.withCharacter': '와 통화 중',
    'ended.goodbye': '안녕히 가세요!',
    'ended.messageChild': '{name}와 이야기했어요!',
    'ended.messageAdult': '{name}와의 대화 즐거우셨나요?',
    'ended.playAgain': '다시 놀기!',
    'system.timeUpChild': '이제 전화를 끊을 시간이에요. 아이에게 귀엽게 이유를 대며 작별인사를 하고 전화를 끊어주세요.',
    'system.timeUpAdult': '이제 대화를 마무리할 시간입니다. 자연스럽게 마무리하며 작별인사를 해주세요.',
    'system.greetAndQuiz': '대화를 시작해주세요. 자기소개를 하고 바로 퀴즈 첫 번째 문제를 내주세요.',
  },
};

export function t(key: TranslationKey, lang: LangCode, vars?: Record<string, string>): string {
  let str = translations[lang]?.[key] ?? translations['ja'][key] ?? key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, v);
    });
  }
  return str;
}

export function getLangCode(languageLabel: string): LangCode {
  const map: Record<string, LangCode> = {
    '日本語': 'ja',
    'English': 'en',
    'Bahasa Melayu': 'ms',
    '中文': 'zh',
    'தமிழ்': 'ta',
    '한국어': 'ko',
  };
  return map[languageLabel] ?? 'ja';
}
