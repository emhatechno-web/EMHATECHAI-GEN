
import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { GENRES, INITIAL_IDEAS_COUNT, VOICE_OPTIONS, UGC_LANGUAGES, LYRIC_LANGUAGES } from './constants';
import { getInitialIdeas, getNewIdea, generateFullStory, generateCharacterProfile, generateImage, polishStory, getNewIdeasFromText, generateStoryAudio, extractNarrationFromStory, generateAffiliatePackage, generateStoryScenes, apiKeyManager, getLyricsFromYoutube, translateLyrics, generateVeoVideo } from './services/geminiService';
import { Genre, StoryIdea, GeneratedImage, AspectRatio, View, CharacterImageData, Gender, Voice, LyricLine, VeoModel, VideoResolution } from './types';
import { Header } from './components/Header';
import { StoryWizard } from './components/StoryWizard';
import { StorybookView } from './components/StorybookView';
import { ImageAffiliateView } from './components/ImageAffiliateView';
import { AboutView } from './components/AboutView';
import { pcmToWavBlob, decodeBase64 } from './utils/audio';
import { TabButton } from './components/common/TabButton';
import { Spinner } from './components/common/Spinner';
import { ApiKeyModal } from './components/ApiKeyModal';
import { MusicLyricView } from './components/MusicLyricView';
import { VideoGeneratorView } from './components/VideoGeneratorView';

const STORY_LOADING_MESSAGES = [
  "EmhaTech sedang membuat gambar, kamu diam aja bikin kopi... ☕",
  "Sedang memanggil roh seniman digital... 🎨",
  "AI lagi mikir keras, jangan diganggu... 🤫",
  "Merangkai kata-kata mutiara (dan visual kece)... ✨",
  "Sabar, karya seni butuh waktu... ⏳",
  "Lagi render pixel demi pixel, awas panas... 🔥",
  "Mengumpulkan inspirasi dari alam semesta... 🌌",
  "Menyusun plot twist yang mencengangkan... 😱",
  "Mewarnai imajinasi kamu... 🖌️",
  "Hampir jadi, jangan tutup tab ya! 🚀"
];

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('wizard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Wizard State
  const [selectedGenre, setSelectedGenre] = useState<Genre>(GENRES[0]);
  const [storyIdeas, setStoryIdeas] = useState<StoryIdea[]>([]);
  const [storyText, setStoryText] = useState<string>('');
  const [characterText, setCharacterText] = useState<string>('');
  const [characterImage, setCharacterImage] = useState<CharacterImageData | null>(null);
  const [animalImage, setAnimalImage] = useState<CharacterImageData | null>(null);
  const [characterGender, setCharacterGender] = useState<Gender>('unspecified');
  const [imageAspectRatio, setImageAspectRatio] = useState<AspectRatio>('9:16');
  
  // Storybook State
  const [fullStory, setFullStory] = useState<string>('');
  const [imagePrompts, setImagePrompts] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice>(VOICE_OPTIONS[0].value);
  const [sceneNarrations, setSceneNarrations] = useState<string[]>([]);

  // Image Affiliate State
  const [affiliateImages, setAffiliateImages] = useState<(CharacterImageData | null)[]>([null, null]);
  const [affiliateScenario, setAffiliateScenario] = useState<string>('');
  const [affiliateGeneratedImages, setAffiliateGeneratedImages] = useState<(GeneratedImage | null)[]>(Array(7).fill(null));
  const [affiliateVideoJsons, setAffiliateVideoJsons] = useState<string[]>([]);
  const [isGeneratingAffiliate, setIsGeneratingAffiliate] = useState<boolean>(false);
  const [affiliateLanguage, setAffiliateLanguage] = useState<string>(UGC_LANGUAGES[0].value);

  // Music Lyric State
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [originalLyrics, setOriginalLyrics] = useState<string>('');
  const [lyricSources, setLyricSources] = useState<{title: string, uri: string}[]>([]);
  const [translatedLyrics, setTranslatedLyrics] = useState<LyricLine[] | null>(null);
  const [selectedLyricLanguage, setSelectedLyricLanguage] = useState<string>(LYRIC_LANGUAGES[0].value);
  const [isFetchingLyrics, setIsFetchingLyrics] = useState<boolean>(false);
  const [isTranslatingLyrics, setIsTranslatingLyrics] = useState<boolean>(false);

  // Video Generator State
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);

  // Global Loading/Error State
  const [isLoadingIdeas, setIsLoadingIdeas] = useState<boolean>(true);
  const [isGeneratingStory, setIsGeneratingStory] = useState<boolean>(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [isPolishing, setIsPolishing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Loading Message State
  const [storyLoadingMsg, setStoryLoadingMsg] = useState(STORY_LOADING_MESSAGES[0]);

  // API Key Modal State
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [currentUserApiKeys, setCurrentUserApiKeys] = useState<string[]>([]);
  
  const debounceTimeout = useRef<number | null>(null);
  
  useEffect(() => {
    let initialTheme: 'light' | 'dark' = 'light';
    try {
        if (typeof localStorage !== 'undefined') {
             const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
             const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
             initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
        }
    } catch (e) {
        console.warn("Failed to access localStorage for theme", e);
    }
    setTheme(initialTheme);
    
    setCurrentUserApiKeys(apiKeyManager.getUserApiKeys());
    
    // Safely check process.env
    let hasSystemKey = false;
    try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            hasSystemKey = true;
        }
    } catch (e) {
        console.warn("Failed to access process.env", e);
    }

    // Jika tidak ada kunci pengguna DAN tidak ada kunci sistem, buka modal secara otomatis.
    if (apiKeyManager.getUserApiKeys().length === 0 && !hasSystemKey) {
        setIsApiKeyModalOpen(true);
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('theme', 'dark'); } catch(e){}
    } else {
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('theme', 'light'); } catch(e){}
    }
  }, [theme]);

  // Effect for cycling story loading messages
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isGeneratingStory) {
        setStoryLoadingMsg(STORY_LOADING_MESSAGES[Math.floor(Math.random() * STORY_LOADING_MESSAGES.length)]);
        interval = setInterval(() => {
            setStoryLoadingMsg(prev => {
                const currentIndex = STORY_LOADING_MESSAGES.indexOf(prev);
                const nextIndex = (currentIndex + 1) % STORY_LOADING_MESSAGES.length;
                return STORY_LOADING_MESSAGES[nextIndex];
            });
        }, 3000); // Ganti pesan setiap 3 detik
    }
    return () => {
        if (interval) clearInterval(interval);
    };
  }, [isGeneratingStory]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleApiError = useCallback((err: any) => {
    console.error("API Error:", err);
    
    const errorMessage = err?.message || "";
    const isQuotaError = errorMessage.includes("429") || 
                        errorMessage.toLowerCase().includes("quota") || 
                        errorMessage.includes("RESOURCE_EXHAUSTED");
    
    setError(errorMessage || "Terjadi kesalahan yang tidak terduga");

    if (err.name === "AllApiKeysFailedError" || isQuotaError) {
        setIsApiKeyModalOpen(true);
        if (isQuotaError) {
             setError("Semua kuota kunci API sistem atau pengguna telah habis. Silakan masukkan kunci API baru.");
        }
    }
  }, []);

  const loadIdeas = useCallback(async (genre: string) => {
    setIsLoadingIdeas(true);
    setError(null);
    try {
      const ideas = await getInitialIdeas(genre, INITIAL_IDEAS_COUNT);
      setStoryIdeas(ideas.map((text, index) => ({ id: `idea-${Date.now()}-${index}`, text })));
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsLoadingIdeas(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    loadIdeas(selectedGenre.name);
  }, [selectedGenre, loadIdeas]);

  const handleSelectIdea = (idea: StoryIdea) => {
    setStoryText(prev => {
        const newText = prev ? `${prev} ${idea.text}` : idea.text;
        // Trigger dynamic suggestions based on new text
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        debounceTimeout.current = window.setTimeout(() => {
            refreshIdeasBasedOnText(newText);
        }, 2000);
        return newText;
    });
  };

  const refreshIdeasBasedOnText = async (text: string) => {
      if (!text || text.length < 20) return;
      setIsLoadingIdeas(true);
      try {
          const newIdeas = await getNewIdeasFromText(selectedGenre.name, text, 4);
          setStoryIdeas(prev => {
              // Keep some old, add new to top
              const mixed = [...newIdeas.map((t, i) => ({ id: `dyn-${Date.now()}-${i}`, text: t })), ...prev.slice(0, 12)];
              return mixed.slice(0, 16);
          });
      } catch (e) {
          console.warn("Failed to refresh dynamic ideas", e);
      } finally {
          setIsLoadingIdeas(false);
      }
  };

  const handleDismissIdea = async (ideaToDismiss: StoryIdea) => {
    const newIdeas = storyIdeas.filter(idea => idea.id !== ideaToDismiss.id);
    setStoryIdeas(newIdeas);
    
    try {
      const newIdeaText = await getNewIdea(selectedGenre.name, newIdeas.map(i => i.text));
      setStoryIdeas(prev => [...prev, { id: `new-${Date.now()}`, text: newIdeaText }]);
    } catch (err) {
       console.warn("Failed to fetch replacement idea", err);
    }
  };

  const handlePolishStory = async () => {
    if (!storyText.trim()) return;
    setIsPolishing(true);
    setError(null);
    try {
      const polished = await polishStory(storyText, selectedGenre.name);
      setStoryText(polished);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsPolishing(false);
    }
  };

  const handleGenerateStory = async () => {
    if (!storyText.trim()) return;
    setIsGeneratingStory(true);
    setError(null);
    setActiveView('storybook'); // Switch immediately to show loading state
    
    try {
      // 1. Generate Full Story
      const story = await generateFullStory(storyText, selectedGenre.name, characterGender);
      setFullStory(story);

      // 2. Extract Scenes & Narrations
      const scenes = await generateStoryScenes(story);
      setSceneNarrations(scenes.map(s => s.narration));
      const prompts = scenes.map(s => s.imagePrompt);
      setImagePrompts(prompts);
      
      // 3. Generate Character Profile (if needed for consistent prompting)
      const charProfile = await generateCharacterProfile(story, characterGender);

      // 4. Generate Images
      setGeneratedImages(prompts.map((p, i) => ({ id: `img-${i}`, prompt: p, src: null, isLoading: true })));
      
      // Generate images in parallel
      prompts.forEach(async (prompt, index) => {
          try {
              // Use uploaded character image if available, otherwise use generated profile text
              const charInfo = characterImage ? [characterImage] : charProfile;
              if (characterImage && animalImage) {
                   // If both exist, passing both might be complex for simple array, 
                   // strictly the service takes CharacterImageData[] or string.
                   // For now let's stick to main character image + text description
                   // Or we can modify service to accept multiple images.
                   // Let's pass array of images if supported.
                   // The current service supports CharacterImageData[]
                   // So we can pass both.
                   // (charInfo as any[]).push(animalImage);
              }

              const src = await generateImage(
                  prompt, 
                  animalImage ? [characterImage!, animalImage] : (characterImage ? [characterImage] : charProfile), 
                  imageAspectRatio, 
                  characterGender
                );
              
              setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, src, isLoading: false } : img));
          } catch (e) {
              console.error(`Failed to generate image ${index}`, e);
              setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, isLoading: false } : img));
          }
      });

    } catch (err) {
      handleApiError(err);
      setActiveView('wizard'); // Go back on critical error
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleRegenerateImage = async (imageToRegen: GeneratedImage) => {
      const index = generatedImages.findIndex(img => img.id === imageToRegen.id);
      if (index === -1) return;

      setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, src: null, isLoading: true } : img));
      
      try {
          const charProfile = characterText || "Consistent character"; // Fallback
          const src = await generateImage(
              imageToRegen.prompt, 
              animalImage && characterImage ? [characterImage, animalImage] : (characterImage ? [characterImage] : charProfile), 
              imageAspectRatio, 
              characterGender,
              "Different angle, dynamic pose"
            );
          setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, src, isLoading: false } : img));
      } catch (err) {
          handleApiError(err);
          setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, isLoading: false } : img));
      }
  };

  const handleDownloadAudio = async () => {
      if (!fullStory) return;
      setIsGeneratingAudio(true);
      try {
          const cleanNarration = await extractNarrationFromStory(fullStory);
          const base64Audio = await generateStoryAudio(cleanNarration, selectedVoice);
          
          const audioBytes = decodeBase64(base64Audio);
          const wavBlob = pcmToWavBlob(audioBytes, 24000, 1, 16);
          
          const url = URL.createObjectURL(wavBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `cerita_emhatech_${Date.now()}.wav`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (err) {
          handleApiError(err);
      } finally {
          setIsGeneratingAudio(false);
      }
  };

  const handleDownloadImages = async () => {
      const validImages = generatedImages.filter(img => img.src);
      if (validImages.length === 0) return;

      const zip = new JSZip();
      
      validImages.forEach((img, i) => {
          const data = img.src!.split(',')[1];
          zip.file(`adegan_${i + 1}.jpg`, data, { base64: true });
      });

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = "ilustrasi_cerita_emhatech.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  // --- Affiliate / UGC Handlers ---

  const handleGenerateAffiliateContent = async (useCharacter: boolean, useProduct: boolean) => {
      if (!affiliateScenario) return;
      if (!affiliateImages[0] && !affiliateImages[1]) {
          setError("Harap unggah setidaknya gambar Karakter atau Produk.");
          return;
      }
      
      setIsGeneratingAffiliate(true);
      setError(null);
      
      // Reset previous results
      setAffiliateGeneratedImages(Array(7).fill(null));
      setAffiliateVideoJsons([]);

      try {
        const charImg = useCharacter ? affiliateImages[0] : null;
        const prodImg = useProduct ? affiliateImages[1] : null;

        const result = await generateAffiliatePackage(
            charImg, 
            prodImg, 
            affiliateScenario,
            affiliateLanguage
        );
        
        // Update state incrementally or all at once
        setAffiliateVideoJsons(result.videoJson.map(j => JSON.stringify(j, null, 2)));
        setAffiliateGeneratedImages(result.images.map((src, i) => ({
            id: `aff-${i}`,
            prompt: result.videoJson[i]?.image_prompt || "UGC Content",
            src,
            isLoading: false
        })));

      } catch (err) {
          handleApiError(err);
      } finally {
          setIsGeneratingAffiliate(false);
      }
  };

  const handleDownloadAffiliateImages = async () => {
      const validImages = affiliateGeneratedImages.filter(img => img && img.src);
      if (validImages.length ===0) return;
      
      const zip = new JSZip();
      validImages.forEach((img, i) => {
          if (img && img.src) {
            const data = img.src.split(',')[1];
            zip.file(`ugc_scene_${i + 1}.jpg`, data, { base64: true });
          }
      });
      
      // Also save prompts
      const prompts = affiliateVideoJsons.join('\n\n---\n\n');
      zip.file("prompts_dan_skrip.txt", prompts);

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = "makasih emha ganteng.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  // --- Music Lyric Handlers ---

  const handleGetLyrics = async () => {
      if (!youtubeUrl) return;
      setIsFetchingLyrics(true);
      setOriginalLyrics('');
      setTranslatedLyrics(null);
      setLyricSources([]);
      setError(null);
      
      try {
          const data = await getLyricsFromYoutube(youtubeUrl);
          setOriginalLyrics(data.lyrics);
          setLyricSources(data.sources);
      } catch (err) {
          handleApiError(err);
      } finally {
          setIsFetchingLyrics(false);
      }
  };

  const handleTranslateLyrics = async () => {
      if (!originalLyrics) return;
      setIsTranslatingLyrics(true);
      setError(null);
      
      try {
          const translated = await translateLyrics(originalLyrics, selectedLyricLanguage);
          setTranslatedLyrics(translated);
      } catch (err) {
          handleApiError(err);
      } finally {
          setIsTranslatingLyrics(false);
      }
  };

  // --- Video Generator Handlers ---

  const handleGenerateVideo = async (prompt: string, aspectRatio: AspectRatio, model: VeoModel, resolution: VideoResolution, image: CharacterImageData | null) => {
      setIsGeneratingVideo(true);
      setGeneratedVideoUrl(null);
      setError(null);

      try {
          const url = await generateVeoVideo(prompt, aspectRatio, model, resolution, image);
          setGeneratedVideoUrl(url);
      } catch (err) {
          handleApiError(err);
      } finally {
          setIsGeneratingVideo(false);
      }
  };

  // --- API Key Handling ---

  const handleSaveApiKeys = (newKeys: string[]) => {
      apiKeyManager.setUserApiKeys(newKeys);
      setCurrentUserApiKeys(newKeys);
      setIsApiKeyModalOpen(false);
      // Retry loading ideas if we are on wizard and they are empty
      if (activeView === 'wizard' && storyIdeas.length === 0) {
          loadIdeas(selectedGenre.name);
      }
      setError(null); // Clear any persistent errors
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 font-sans transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-6">
        <Header theme={theme} onThemeToggle={toggleTheme} onApiKeySettingsClick={() => setIsApiKeyModalOpen(true)} />

        {error && (
          <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg relative animate-fade-in" role="alert">
            <strong className="font-bold block sm:inline">Terjadi Kesalahan: </strong>
            <span className="block sm:inline">{error}</span>
            <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
              <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
            </span>
          </div>
        )}

        <nav className="flex flex-wrap justify-center gap-2 sm:gap-4 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <TabButton name="Generator Cerita" active={activeView === 'wizard' || activeView === 'storybook'} onClick={() => setActiveView('wizard')} />
            <TabButton name="UGC IMG & Prompt" active={activeView === 'imageAffiliate'} onClick={() => setActiveView('imageAffiliate')} />
            <TabButton name="Lirik Musik" active={activeView === 'musicLyric'} onClick={() => setActiveView('musicLyric')} />
            <TabButton name="Video Veo" active={activeView === 'videoGenerator'} onClick={() => setActiveView('videoGenerator')} />
            <TabButton name="About" active={activeView === 'about'} onClick={() => setActiveView('about')} />
        </nav>

        <main className="transition-all duration-500">
          {activeView === 'wizard' && (
            <StoryWizard
              genres={GENRES}
              selectedGenre={selectedGenre}
              onGenreChange={setSelectedGenre}
              storyIdeas={storyIdeas}
              isLoadingIdeas={isLoadingIdeas}
              onSelectIdea={handleSelectIdea}
              storyText={storyText}
              onStoryTextChange={setStoryText}
              onDismissIdea={handleDismissIdea}
              isStoryReady={storyText.length > 20}
              onGenerateStory={handleGenerateStory}
              isGeneratingStory={isGeneratingStory}
              onPolishStory={handlePolishStory}
              isPolishing={isPolishing}
              characterImage={characterImage}
              onCharacterImageChange={setCharacterImage}
              onCharacterTextChange={setCharacterText}
              characterText={characterText}
              characterGender={characterGender}
              onCharacterGenderChange={setCharacterGender}
              animalImage={animalImage}
              onAnimalImageChange={setAnimalImage}
              imageAspectRatio={imageAspectRatio}
              onImageAspectRatioChange={setImageAspectRatio}
            />
          )}

          {activeView === 'storybook' && (
            <StorybookView 
                fullStory={fullStory}
                generatedImages={generatedImages}
                isGeneratingAudio={isGeneratingAudio}
                onDownloadAudio={handleDownloadAudio}
                onDownloadImages={handleDownloadImages}
                onRegenerateImage={handleRegenerateImage}
                selectedVoice={selectedVoice}
                onVoiceChange={setSelectedVoice}
                voiceOptions={VOICE_OPTIONS}
                sceneNarrations={sceneNarrations}
            />
          )}

          {activeView === 'imageAffiliate' && (
              <ImageAffiliateView 
                  baseImages={affiliateImages}
                  onBaseImageChange={(img, idx) => {
                      const newImgs = [...affiliateImages];
                      newImgs[idx] = img;
                      setAffiliateImages(newImgs);
                  }}
                  isGenerating={isGeneratingAffiliate}
                  onGenerate={handleGenerateAffiliateContent}
                  generatedImages={affiliateGeneratedImages}
                  videoJsons={affiliateVideoJsons}
                  onDownloadAll={handleDownloadAffiliateImages}
                  scenario={affiliateScenario}
                  onScenarioChange={setAffiliateScenario}
                  languages={UGC_LANGUAGES}
                  selectedLanguage={affiliateLanguage}
                  onLanguageChange={setAffiliateLanguage}
              />
          )}

          {activeView === 'musicLyric' && (
              <MusicLyricView 
                  youtubeUrl={youtubeUrl}
                  onYoutubeUrlChange={setYoutubeUrl}
                  onGetLyrics={handleGetLyrics}
                  isFetchingLyrics={isFetchingLyrics}
                  originalLyrics={originalLyrics}
                  onOriginalLyricsChange={setOriginalLyrics}
                  lyricSources={lyricSources}
                  onTranslateLyrics={handleTranslateLyrics}
                  isTranslatingLyrics={isTranslatingLyrics}
                  translatedLyrics={translatedLyrics}
                  languages={LYRIC_LANGUAGES}
                  selectedLanguage={selectedLyricLanguage}
                  onLanguageChange={setSelectedLyricLanguage}
              />
          )}

          {activeView === 'videoGenerator' && (
              <VideoGeneratorView 
                  isGenerating={isGeneratingVideo}
                  onGenerate={handleGenerateVideo}
                  videoUrl={generatedVideoUrl}
                  onReset={() => setGeneratedVideoUrl(null)}
              />
          )}

          {activeView === 'about' && <AboutView />}
        </main>

        <ApiKeyModal 
            isOpen={isApiKeyModalOpen}
            currentApiKeys={currentUserApiKeys}
            onClose={() => setIsApiKeyModalOpen(false)}
            onSave={handleSaveApiKeys}
        />

        {/* Storybook Loading Popup */}
        {isGeneratingStory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border-2 border-cyan-500/50 transform scale-100 transition-transform">
              <div className="relative mb-8">
                  <div className="absolute inset-0 flex items-center justify-center animate-ping opacity-30">
                      <div className="h-20 w-20 bg-cyan-500 rounded-full"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center animate-ping animation-delay-500 opacity-20">
                      <div className="h-24 w-24 bg-cyan-400 rounded-full"></div>
                  </div>
                  <Spinner className="h-20 w-20 text-cyan-600 dark:text-cyan-400 mx-auto relative z-10" />
              </div>
              <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 mb-4 animate-pulse">
                  Sedang Berkarya...
              </h3>
              <p className="text-xl text-slate-700 dark:text-slate-300 font-medium min-h-[4rem] flex items-center justify-center leading-relaxed">
                  "{storyLoadingMsg}"
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;
