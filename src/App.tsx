/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Phone, PhoneOff, Settings, User, Globe } from 'lucide-react';
import { analyzeObject, ChatSession, CharacterProfile, Persona, PERSONAS } from './services/gemini';
import { t, getLangCode, LangCode } from './i18n/translations';
import { getUsageData, recordSession, isLimitReached, MAX_SESSIONS_PER_DAY } from './lib/usageTracker';

type AppState = 'language' | 'setup' | 'camera' | 'analyzing' | 'incoming' | 'talking' | 'ended';

const STORAGE_KEY = 'talkativeCamera_personaId';
const LANGUAGE_STORAGE_KEY = 'talkativeCamera_language';

const LANGUAGES = [
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
];

export default function App() {
  const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? '';

  const [state, setState] = useState<AppState>(savedLanguage ? 'setup' : 'language');
  const [personaId, setPersonaId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? 'kinder'
  );
  const [language, setLanguage] = useState<string>(savedLanguage);
  const [photo, setPhoto] = useState<string | null>(null);
  const [character, setCharacter] = useState<CharacterProfile | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(100);
  const [isMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<{ speaker: 'user' | 'model', text: string, finished: boolean }[]>([]);
  const [analysisError, setAnalysisError] = useState(false);
  const [usageData, setUsageData] = useState(() => getUsageData());
  const [callState, setCallState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatSessionRef = useRef<ChatSession | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isEndingRef = useRef(false);

  const currentPersona: Persona = PERSONAS.find(p => p.id === personaId) ?? PERSONAS[1];
  const langCode: LangCode = getLangCode(language);

  // Persist persona selection
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, personaId);
  }, [personaId]);

  // Camera setup
  useEffect(() => {
    if (state === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [state]);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported in this browser.");
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
      } catch (e) {
        console.warn("Environment camera failed, trying default", e);
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      let attempts = 0;
      const attachStream = () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.error("Video play failed", e));
          };
        } else if (attempts < 10) {
          attempts++;
          setTimeout(attachStream, 100);
        } else {
          console.error("videoRef is still null after 1 second");
        }
      };

      attachStream();
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      alert(`Camera access failed.\n(${err.message || err})`);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context && video.videoWidth > 0) {
        const maxDim = 1024;
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > height) {
          if (width > maxDim) { height *= maxDim / width; width = maxDim; }
        } else {
          if (height > maxDim) { width *= maxDim / height; height = maxDim; }
        }

        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhoto(dataUrl);
        handleAnalysis(dataUrl);
      }
    }
  };

  const handleAnalysis = async (imageData: string) => {
    if (isLimitReached()) {
      setState('setup');
      return;
    }

    setState('analyzing');
    try {
      const base64 = imageData.split(',')[1];
      if (!base64) throw new Error("Invalid image data");

      console.log("Starting analysis, image size:", Math.round(base64.length / 1024), "KB");
      const profile = await analyzeObject(base64, currentPersona, language);
      const updated = recordSession();
      setUsageData(updated);
      setCharacter(profile);
      setState('incoming');
    } catch (err: any) {
      console.error("Analysis failed:", err);
      setAnalysisError(true);
      setTimeout(() => {
        setAnalysisError(false);
        setState('camera');
      }, 3000);
    }
  };

  const startCall = () => {
    isEndingRef.current = false;
    setState('talking');
    setTimeLeft(100);
    setCallState('idle');

    // Initialize Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      const langMapping: Record<LangCode, string> = {
        'ja': 'ja-JP', 'en': 'en-US', 'ms': 'ms-MY', 'zh': 'zh-CN', 'ko': 'ko-KR', 'ta': 'ta-IN'
      };
      recognition.lang = langMapping[langCode] || 'en-US';
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text && chatSessionRef.current) {
          setCallState('processing');
          chatSessionRef.current.sendText(text);
        } else {
          setCallState('idle');
        }
      };

      recognition.onerror = (e: any) => {
        console.error("Speech recognition error", e);
        setCallState('idle');
      };

      recognition.onend = () => {
        setCallState(prev => prev === 'listening' ? 'idle' : prev);
      };

      recognitionRef.current = recognition;
    }

    chatSessionRef.current = new ChatSession(character!, currentPersona, language, {
      onTranscript: (speaker: 'user' | 'model', text: string, isFinal: boolean, isDelta: boolean) => {
        setTranscripts(prev => {
          const newTranscripts = [...prev];
          const last = newTranscripts[newTranscripts.length - 1];
          if (last && last.speaker === speaker && !last.finished) {
            if (isDelta) { last.text += text; } else { last.text = text; }
            last.finished = isFinal;
          } else {
            newTranscripts.push({ speaker, text, finished: isFinal });
          }
          return newTranscripts.slice(-5);
        });

        if (speaker === 'model' && isFinal) {
          setCallState('speaking');
        }
      },
      onTurnComplete: () => {
        setCallState('idle');
      },
      onError: (err: any) => {
        console.error("ChatSession error:", err);
        setCallState('idle');
      }
    });

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleTimeUp(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeUp = () => {
    if (chatSessionRef.current) {
      const endMessage = currentPersona.isChild
        ? t('system.timeUpChild', langCode)
        : t('system.timeUpAdult', langCode);
      chatSessionRef.current.sendText(endMessage);
    }
    setTimeout(() => { endCall(); }, 10000);
  };

  const endCall = () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
    chatSessionRef.current?.close();
    setState('ended');
  };

  const reset = () => {
    // isEndingRef はここでリセットしない。
    // startCall() まで true のままにして、遅延する onClose を確実にブロックする。
    setState('setup');
    setPhoto(null);
    setCharacter(null);
    setTranscripts([]);
    setUsageData(getUsageData());
  };

  const handleLanguageSelect = (lang: typeof LANGUAGES[0]) => {
    setLanguage(lang.label);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang.label);
    setState('setup');
  };

  const limitReached = isLimitReached();

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">

        {/* ── LANGUAGE SELECTION ── */}
        {state === 'language' && (
          <motion.div
            key="language"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col items-center justify-center p-6 space-y-10 bg-gradient-to-b from-indigo-900 to-purple-900"
          >
            <div className="text-center space-y-3">
              <div className="text-7xl">📸</div>
              <h1 className="text-2xl font-bold text-white">言語を選んでください</h1>
              <p className="text-purple-300 text-sm">Choose your language</p>
            </div>
            <div className="w-full max-w-xs grid grid-cols-3 gap-3">
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => handleLanguageSelect(l)}
                  className="py-6 rounded-2xl bg-white/10 hover:bg-white/20 flex flex-col items-center gap-2 transition-all active:scale-95"
                >
                  <span className="text-4xl">{l.flag}</span>
                  <span className="text-xs text-white font-medium">{l.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── SETUP ── */}
        {state === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 bg-gradient-to-b from-amber-200 to-orange-300"
          >
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-emerald-700">{t('setup.title', langCode)}</h1>
              <p className="text-orange-700">{t('setup.subtitle', langCode)}</p>
            </div>

            <div className="w-full max-w-xs space-y-6">
              <div className="space-y-3">
                <label className="flex items-center text-sm font-medium text-orange-800">
                  <User className="w-4 h-4 mr-2" /> {t('setup.whoLabel', langCode)}
                </label>

                {/* Kids section */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-orange-700 tracking-wide">{t('setup.sectionKids', langCode)}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {PERSONAS.filter(p => p.isChild).map(p => (
                      <button
                        key={p.id}
                        onClick={() => setPersonaId(p.id)}
                        className={`py-3 px-1 rounded-xl transition-all flex flex-col items-center gap-1 ${personaId === p.id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-white/60 text-orange-900'}`}
                      >
                        <span className="text-2xl">{p.emoji}</span>
                        <span className="text-xs font-bold leading-tight">{p.localizedLabels[language] ?? p.label}</span>
                        <span className="text-xs opacity-70">{p.localizedAgeRanges[language] ?? p.ageRange}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Adult section */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-orange-700 tracking-wide">{t('setup.sectionAdult', langCode)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PERSONAS.filter(p => !p.isChild).map(p => (
                      <button
                        key={p.id}
                        onClick={() => setPersonaId(p.id)}
                        className={`py-3 px-1 rounded-xl transition-all flex flex-col items-center gap-1 ${personaId === p.id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-white/60 text-orange-900'}`}
                      >
                        <span className="text-2xl">{p.emoji}</span>
                        <span className="text-xs font-bold leading-tight">{p.localizedLabels[language] ?? p.label}</span>
                        <span className="text-xs opacity-70">{p.localizedAgeRanges[language] ?? p.ageRange}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Language badge — compact, no redundant grid */}
              <div className="flex items-center justify-between px-3 py-2 bg-white/40 rounded-xl">
                <span className="flex items-center gap-2 text-sm text-orange-800">
                  <Globe className="w-4 h-4" />
                  {LANGUAGES.find(l => l.label === language)?.flag}{' '}
                  <span className="font-medium">{language}</span>
                </span>
                <button
                  onClick={() => setState('language')}
                  className="text-xs text-orange-600 underline"
                >
                  {t('setup.changeLanguage', langCode)}
                </button>
              </div>

              <button
                onClick={() => setState('camera')}
                disabled={limitReached}
                className={`w-full font-bold py-5 rounded-2xl shadow-xl transition-all active:scale-95 text-lg ${limitReached ? 'bg-neutral-400 text-neutral-600 cursor-not-allowed shadow-none' : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/30'}`}
              >
                {limitReached ? t('setup.limitReached', langCode) : t('setup.startButton', langCode)}
              </button>

              {/* Dev usage indicator */}
              <p className={`text-xs font-mono text-center ${limitReached ? 'text-red-600' : 'text-orange-600/50'}`}>
                🛠 Dev: Today {usageData.sessions}/{MAX_SESSIONS_PER_DAY} (~{usageData.estimatedCostYen}¥)
              </p>
            </div>
          </motion.div>
        )}

        {/* ── CAMERA ── */}
        {state === 'camera' && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 relative"
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            <div className="absolute inset-0 flex flex-col justify-between p-8 pointer-events-none">
              <div className="flex justify-between items-start">
                <button
                  onClick={() => setState('setup')}
                  className="p-3 bg-black/40 backdrop-blur-md rounded-full pointer-events-auto"
                >
                  <Settings className="w-6 h-6" />
                </button>
                <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2">
                  <span className="text-xl">📷</span>
                  <span>{t('camera.hint', langCode)}</span>
                </div>
              </div>

              <div className="flex flex-col items-center space-y-3 pb-8 pointer-events-auto">
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  className="text-3xl pointer-events-none select-none"
                >
                  👇
                </motion.div>
                <button
                  onClick={takePhoto}
                  className="w-24 h-24 bg-white rounded-full border-8 border-neutral-300/50 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Camera className="w-9 h-9 text-white" />
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ANALYZING ── */}
        {state === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 bg-sky-400"
          >
            <AnimatePresence mode="wait">
              {analysisError ? (
                <motion.div
                  key="error"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center space-y-4 text-center"
                >
                  <div className="text-8xl">😅</div>
                  <h2 className="text-3xl font-bold text-white">{t('analyzing.error.title', langCode)}</h2>
                  <p className="text-white/80 text-lg">{t('analyzing.error.subtitle', langCode)}</p>
                </motion.div>
              ) : (
                <motion.div
                  key="loading"
                  className="flex flex-col items-center space-y-8"
                >
                  <div className="flex space-x-4">
                    {['✨', '🌟', '✨'].map((star, i) => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -24, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                        className="text-5xl"
                      >
                        {star}
                      </motion.div>
                    ))}
                  </div>
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], rotate: [-5, 5, -5] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="text-9xl select-none"
                  >
                    ❓
                  </motion.div>
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold text-white">{t('analyzing.loading.title', langCode)}</h2>
                    <p className="text-white/80 text-lg">{t('analyzing.loading.subtitle', langCode)}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── INCOMING ── */}
        {state === 'incoming' && (
          <motion.div
            key="incoming"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-between p-12 bg-gradient-to-b from-violet-500 to-indigo-600"
          >
            <div className="text-center space-y-4 mt-12">
              <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-emerald-500 shadow-2xl shadow-emerald-500/20 bg-white">
                <img src={character?.imageUrl || photo!} alt="Character" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-1">
                <h2 className="text-3xl font-bold">{character?.nickname}</h2>
                <p className="text-sm text-white/60">（{character?.name}）</p>
                <p className="text-yellow-300 font-medium animate-pulse">{t('incoming.calling', langCode)}</p>
              </div>
              <div className="max-w-xs mx-auto bg-white/20 p-3 rounded-xl border border-white/20">
                <p className="text-xs text-white/90">
                  <span className="text-yellow-300 font-bold">{t('incoming.triviaLabel', langCode)}</span>
                  {character?.trivia}
                </p>
              </div>
            </div>

            <div className="w-full max-w-xs flex justify-center items-center mb-12">
              <motion.button
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                onClick={startCall}
                className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/50 active:scale-90 transition-transform"
              >
                <Phone className="w-12 h-12 text-white" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── TALKING ── */}
        {state === 'talking' && (
          <motion.div
            key="talking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-between p-8 bg-indigo-900"
          >
            <div className="w-full flex flex-col items-center space-y-1 z-30">
              <div className="text-white/70 text-sm font-bold">
                {character?.nickname}{t('talking.withCharacter', langCode)}
              </div>
              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-400 rounded-full"
                  animate={{ width: `${(timeLeft / 100) * 100}%` }}
                  transition={{ duration: 1, ease: "linear" }}
                />
              </div>
            </div>

            <div className="relative flex-1 flex items-center justify-center w-full">
              <div className="absolute inset-0 flex flex-col p-4 space-y-3 overflow-hidden z-20 pointer-events-none justify-end pb-8">
                {transcripts.map((t_item, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i}
                    className={`flex ${t_item.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm backdrop-blur-md ${t_item.speaker === 'user' ? 'bg-emerald-500/80 text-white rounded-br-sm' : 'bg-white/80 text-neutral-900 rounded-bl-sm shadow-lg'}`}>
                      {t_item.text}
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl"
              />
              <div className="relative z-10 w-48 h-48 rounded-full overflow-hidden border-4 border-emerald-500 shadow-2xl bg-white">
                <img src={character?.imageUrl || photo!} alt="Character" className="w-full h-full object-cover" />
              </div>
            </div>

            <div className="w-full max-w-xs space-y-6 mb-8">
              <div className="flex justify-center space-x-6">
                <button
                  onPointerDown={() => {
                    if (recognitionRef.current && callState === 'idle') {
                      try {
                        recognitionRef.current.start();
                        setCallState('listening');
                      } catch (e) {
                        console.error(e);
                      }
                    }
                  }}
                  onPointerUp={() => {
                    if (recognitionRef.current && callState === 'listening') {
                      recognitionRef.current.stop();
                    }
                  }}
                  onPointerLeave={() => {
                    if (recognitionRef.current && callState === 'listening') {
                      recognitionRef.current.stop();
                    }
                  }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform ${callState === 'listening' ? 'bg-indigo-400 scale-110' : 'bg-emerald-500 active:scale-95'}`}
                >
                  <Phone className={`w-10 h-10 ${callState === 'listening' ? 'text-indigo-900 animate-pulse' : 'text-white'}`} />
                </button>
                <button
                  onClick={endCall}
                  className="w-20 h-20 bg-neutral-600 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                >
                  <PhoneOff className="w-10 h-10 text-white" />
                </button>
              </div>
              <div className="text-center">
                <p className="text-white/80 font-bold mb-2">
                  {callState === 'idle' ? 'おして話す📱 / Hold to talk' :
                    callState === 'listening' ? '聞いています👂...' :
                      callState === 'processing' ? '考えています🤔...' :
                        '話しています👄...'}
                </p>
                <p className="text-white/40 text-sm italic">"{character?.catchphrase}"</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ENDED ── */}
        {state === 'ended' && (
          <motion.div
            key="ended"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 bg-gradient-to-b from-emerald-400 to-teal-500 relative overflow-hidden"
          >
            {['🎉', '⭐', '🎊', '💫', '🌟'].map((emoji, i) => (
              <motion.div
                key={i}
                className="absolute text-4xl pointer-events-none select-none"
                initial={{ y: 400, opacity: 0 }}
                animate={{ y: -100, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 2.5, delay: i * 0.3, repeat: Infinity, repeatDelay: 1.5 }}
                style={{ left: `${15 + i * 17}%` }}
              >
                {emoji}
              </motion.div>
            ))}

            <div className="text-center space-y-4 z-10">
              {character?.imageUrl && (
                <motion.div
                  animate={{ rotate: [-3, 3, -3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="w-28 h-28 mx-auto rounded-full overflow-hidden border-4 border-white shadow-2xl bg-white"
                >
                  <img src={character.imageUrl} alt="Character" className="w-full h-full object-cover" />
                </motion.div>
              )}
              <motion.h2
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-5xl font-bold text-white"
              >
                {t('ended.goodbye', langCode)}
              </motion.h2>
              <p className="text-white/90 text-lg">
                {currentPersona.isChild
                  ? t('ended.messageChild', langCode, { name: character?.nickname ?? '' })
                  : t('ended.messageAdult', langCode, { name: character?.nickname ?? '' })}
              </p>
            </div>

            <button
              onClick={reset}
              className="z-10 w-full max-w-xs bg-white text-emerald-600 font-bold py-5 rounded-2xl shadow-xl transition-all active:scale-95 text-lg"
            >
              {t('ended.playAgain', langCode)}
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
