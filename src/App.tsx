/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Phone, PhoneOff, Settings, RefreshCw, User, Globe, Mic, MicOff } from 'lucide-react';
import { analyzeObject, GeminiLiveSession, CharacterProfile } from './services/gemini';
import { AudioRecorder, AudioStreamer } from './lib/audio';

type AppState = 'setup' | 'camera' | 'analyzing' | 'incoming' | 'talking' | 'ended';

export default function App() {
  const [state, setState] = useState<AppState>('setup');
  const [age, setAge] = useState<number>(5);
  const [language, setLanguage] = useState<string>('日本語');
  const [photo, setPhoto] = useState<string | null>(null);
  const [character, setCharacter] = useState<CharacterProfile | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(100); // 100 seconds
  const [isMuted, setIsMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<{speaker: 'user' | 'model', text: string, finished: boolean}[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveSessionRef = useRef<GeminiLiveSession | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
        throw new Error("お使いのブラウザはカメラに対応していません。");
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
      
      // Ensure videoRef is populated (might be delayed due to AnimatePresence)
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
      alert(`カメラにアクセスできませんでした。\n(${err.message || err})`);
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
        // Resize to max 1024px to ensure reliability
        const maxDim = 1024;
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);
        
        // Use a slightly lower quality to reduce payload size
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhoto(dataUrl);
        handleAnalysis(dataUrl);
      }
    }
  };

  const handleAnalysis = async (imageData: string) => {
    setState('analyzing');
    try {
      const base64 = imageData.split(',')[1];
      if (!base64) throw new Error("Invalid image data");
      
      console.log("Starting analysis, image size:", Math.round(base64.length / 1024), "KB");
      const profile = await analyzeObject(base64, age, language);
      setCharacter(profile);
      setState('incoming');
    } catch (err: any) {
      console.error("Analysis failed:", err);
      const errorMessage = err?.message || JSON.stringify(err);
      alert(`ごめんね、うまく解析できなかったよ。もう一回撮ってみてね！\n(Error: ${errorMessage.substring(0, 100)})`);
      setState('camera');
    }
  };

  const startCall = () => {
    setState('talking');
    setTimeLeft(100);
    
    streamerRef.current = new AudioStreamer();
    recorderRef.current = new AudioRecorder((base64) => {
      if (!isMuted && liveSessionRef.current) {
        liveSessionRef.current.sendAudio(base64);
      }
    });

    liveSessionRef.current = new GeminiLiveSession();
    liveSessionRef.current.connect(character!, age, language, {
      onAudio: (base64) => streamerRef.current?.addPCM16(base64),
      onInterrupted: () => {
        // Handle interruption if needed
      },
      onTranscript: (speaker, text, isFinal, isDelta) => {
        setTranscripts(prev => {
          const newTranscripts = [...prev];
          const last = newTranscripts[newTranscripts.length - 1];
          if (last && last.speaker === speaker && !last.finished) {
            if (isDelta) {
              last.text += text;
            } else {
              last.text = text;
            }
            last.finished = isFinal;
          } else {
            newTranscripts.push({ speaker, text, finished: isFinal });
          }
          return newTranscripts.slice(-5); // Keep last 5 messages
        });
      },
      onTurnComplete: () => {
        setTranscripts(prev => {
          const newTranscripts = [...prev];
          const last = newTranscripts[newTranscripts.length - 1];
          if (last && last.speaker === 'model') {
            last.finished = true;
          }
          return newTranscripts;
        });
      },
      onClose: () => endCall(),
      onError: (err) => console.error("Live session error:", err),
    });

    recorderRef.current.start();

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeUp = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.sendText("そろそろ電話を切る時間です。子供にバイバイと言って、可愛い言い訳をして電話を切ってください。");
    }
    // Give a few seconds for the character to finish talking
    setTimeout(() => {
      endCall();
    }, 10000);
  };

  const endCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    streamerRef.current?.stop();
    liveSessionRef.current?.close();
    setState('ended');
  };

  const reset = () => {
    setState('setup');
    setPhoto(null);
    setCharacter(null);
    setTranscripts([]);
  };

  const LANGUAGES = [
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
  ];

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">
        {state === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col items-center justify-center p-6 space-y-8"
          >
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-emerald-400">おしゃべりカメラ</h1>
              <p className="text-neutral-400">モノと電話でお話ししよう！</p>
            </div>

            <div className="w-full max-w-xs space-y-6">
              <div className="space-y-3">
                <label className="flex items-center text-sm font-medium text-neutral-300">
                  <User className="w-4 h-4 mr-2" /> なんさい？
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[3, 4, 5, 6, 7].map(n => (
                    <button
                      key={n}
                      onClick={() => setAge(n)}
                      className={`py-3 rounded-xl transition-all ${age === n ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center text-sm font-medium text-neutral-300">
                  <Globe className="w-4 h-4 mr-2" /> ことば
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => setLanguage(l.label)}
                      className={`py-3 rounded-xl transition-all flex flex-col items-center justify-center space-y-1 ${language === l.label ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                      <span className="text-2xl">{l.flag}</span>
                      <span className="text-xs">{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setState('camera')}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-5 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
              >
                はじめる！
              </button>
            </div>
          </motion.div>
        )}

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
                <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full text-sm font-medium">
                  しゃべらせたいモノをうつしてね
                </div>
              </div>

              <div className="flex justify-center items-center pb-8">
                <button
                  onClick={takePhoto}
                  className="w-20 h-20 bg-white rounded-full border-8 border-neutral-300/50 flex items-center justify-center pointer-events-auto active:scale-90 transition-transform"
                >
                  <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {state === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 bg-emerald-900"
          >
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-32 h-32 border-4 border-emerald-400/20 border-t-emerald-400 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <RefreshCw className="w-10 h-10 text-emerald-400" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">だれかな？だれかな？</h2>
              <p className="text-emerald-300/60">モノのなまえをかんがえちゅう...</p>
            </div>
          </motion.div>
        )}

        {state === 'incoming' && (
          <motion.div
            key="incoming"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-between p-12 bg-neutral-900"
          >
            <div className="text-center space-y-4 mt-12">
              <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-emerald-500 shadow-2xl shadow-emerald-500/20 bg-white">
                <img src={character?.imageUrl || photo!} alt="Character" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-1">
                <h2 className="text-3xl font-bold">{character?.nickname}</h2>
                <p className="text-sm text-neutral-400">（{character?.name}）</p>
                <p className="text-emerald-400 font-medium animate-pulse">でんわがかかってきたよ！</p>
              </div>
              <div className="max-w-xs mx-auto bg-neutral-800/50 p-3 rounded-xl border border-white/5">
                <p className="text-xs text-neutral-300">
                  <span className="text-emerald-400 font-bold">まめちしき：</span>
                  {character?.trivia}
                </p>
              </div>
            </div>

            <div className="w-full max-w-xs flex justify-around items-center mb-12">
              <button
                onClick={reset}
                className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/20 active:scale-90 transition-transform"
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
              <motion.button
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                onClick={startCall}
                className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/40 active:scale-90 transition-transform"
              >
                <Phone className="w-10 h-10 text-white" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {state === 'talking' && (
          <motion.div
            key="talking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-between p-8 bg-neutral-950"
          >
            <div className="w-full flex justify-between items-center z-30">
              <div className="bg-neutral-800 px-4 py-2 rounded-full text-sm font-mono text-emerald-400">
                {timeLeft}
              </div>
              <div className="text-neutral-500 text-xs uppercase tracking-widest font-bold">
                Talking with {character?.nickname}
              </div>
            </div>

            <div className="relative flex-1 flex items-center justify-center w-full">
              <div className="absolute inset-0 flex flex-col p-4 space-y-3 overflow-hidden z-20 pointer-events-none justify-end pb-8">
                {transcripts.map((t, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i} 
                    className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm backdrop-blur-md ${t.speaker === 'user' ? 'bg-emerald-500/80 text-white rounded-br-sm' : 'bg-white/80 text-neutral-900 rounded-bl-sm shadow-lg'}`}>
                      {t.text}
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                  opacity: [0.3, 0.6, 0.3]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl"
              />
              <div className="relative z-10 w-48 h-48 rounded-full overflow-hidden border-4 border-emerald-500 shadow-2xl bg-white">
                <img src={character?.imageUrl || photo!} alt="Character" className="w-full h-full object-cover" />
              </div>
            </div>

            <div className="w-full max-w-xs space-y-8 mb-8">
              <div className="flex justify-center space-x-8">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-neutral-800 text-white'}`}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
                <button
                  onClick={endCall}
                  className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/20 active:scale-90 transition-transform"
                >
                  <PhoneOff className="w-8 h-8 text-white" />
                </button>
              </div>
              <div className="text-center">
                <p className="text-neutral-400 text-sm italic">"{character?.catchphrase}"</p>
              </div>
            </div>
          </motion.div>
        )}

        {state === 'ended' && (
          <motion.div
            key="ended"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex-1 flex flex-col items-center justify-center p-6 space-y-8"
          >
            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto bg-neutral-800 rounded-full flex items-center justify-center">
                <PhoneOff className="w-10 h-10 text-neutral-500" />
              </div>
              <h2 className="text-3xl font-bold">またね！</h2>
              <p className="text-neutral-400">{character?.nickname}とお話しできて楽しかったね！</p>
            </div>

            <button
              onClick={reset}
              className="w-full max-w-xs bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-5 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
            >
              もういちどあそぶ
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
