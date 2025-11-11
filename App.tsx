import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { GENRES, INITIAL_IDEAS_COUNT, VOICE_OPTIONS, UGC_LANGUAGES } from './constants';
import { initializeAiClient, getInitialIdeas, getNewIdea, generateFullStory, generateCharacterProfile, generateImagePrompts, generateImage, polishStory, getNewIdeasFromText, generateStoryAudio, extractNarrationFromStory, generateVideoFromStory, splitStoryIntoSceneNarrations, generateVideoForScene, generateAffiliatePackage, generateAffiliateScenario } from './services/geminiService';
import { Genre, StoryIdea, GeneratedImage, AspectRatio, View, CharacterImageData, Gender, Voice } from './types';
import { Header } from './components/Header';
import { StoryWizard } from './components/StoryWizard';
import { StorybookView } from './components/StorybookView';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ImageAffiliateView } from './components/ImageAffiliateView';
import { AboutView } from './components/AboutView';
import { pcmToWavBlob, decodeBase64 } from './utils/audio';
import { TabButton } from './components/common/TabButton';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('wizard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || process.env.API_KEY || '');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  // Wizard State
  const [selectedGenre, setSelectedGenre] = useState<Genre>(GENRES[0]);
  const [storyIdeas, setStoryIdeas] = useState<StoryIdea[]>([]);
  const [storyText, setStoryText] = useState<string>('');
  const [characterText, setCharacterText] = useState<string>('');
  const [characterImage, setCharacterImage] = useState<CharacterImageData | null>(null);
  const [characterGender, setCharacterGender] = useState<Gender>('unspecified');
  const [imageAspectRatio, setImageAspectRatio] = useState<AspectRatio>('16:9');
  
  // Storybook State
  const [fullStory, setFullStory] = useState<string>('');
  const [imagePrompts, setImagePrompts] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice>(VOICE_OPTIONS[0].value);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [sceneNarrations, setSceneNarrations] = useState<string[]>([]);
  const [generatedSceneVideos, setGeneratedSceneVideos] = useState<Map<string, string>>(new Map());
  const [generatingSceneVideoIds, setGeneratingSceneVideoIds] = useState<Set<string>>(new Set());

  // Image Affiliate State
  const [affiliateImages, setAffiliateImages] = useState<(CharacterImageData | null)[]>([null, null]);
  const [affiliateScenario, setAffiliateScenario] = useState<string>('');
  const [affiliateGeneratedImages, setAffiliateGeneratedImages] = useState<(GeneratedImage | null)[]>(Array(7).fill(null));
  const [affiliateVideoJsons, setAffiliateVideoJsons] = useState<string[]>([]);
  const [isGeneratingAffiliate, setIsGeneratingAffiliate] = useState<boolean>(false);
  const [isGeneratingAffiliateIdea, setIsGeneratingAffiliateIdea] = useState<boolean>(false);
  const [affiliateLanguage, setAffiliateLanguage] = useState<string>(UGC_LANGUAGES[0].value);


  // Global Loading/Error State
  const [isLoadingIdeas, setIsLoadingIdeas] = useState<boolean>(true);
  const [isGeneratingStory, setIsGeneratingStory] = useState<boolean>(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);
  const [isPolishing, setIsPolishing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const debounceTimeout = useRef<number | null>(null);
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const handleThemeToggle = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    if (!apiKey) {
      setError('Kunci API Gemini diperlukan. Silakan atur di pengaturan.');
      return;
    }
    try {
      initializeAiClient(apiKey);
      setError(null); // Menghapus kesalahan apa pun saat inisialisasi berhasil
    } catch (e) {
      console.error(e);
      setError('Kunci API tidak valid. Silakan perbarui di pengaturan.');
    }
  }, [apiKey]);


  const populateInitialIdeas = useCallback(async (genre: Genre) => {
    if (!apiKey) return;
    setIsLoadingIdeas(true);
    setError(null);
    try {
      const ideas = await getInitialIdeas(genre.value, INITIAL_IDEAS_COUNT);
      setStoryIdeas(ideas.map(idea => ({ id: crypto.randomUUID(), text: idea })));
    } catch (err) {
      console.error(err);
      setError('Gagal memuat ide cerita awal. Silakan periksa kunci API Anda dan coba lagi.');
    } finally {
      setIsLoadingIdeas(false);
    }
  }, [apiKey]);

  useEffect(() => {
    populateInitialIdeas(selectedGenre);
  }, [selectedGenre, populateInitialIdeas]);
  
  useEffect(() => {
    if (activeView !== 'wizard') return;
    if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
    }
    if (!storyText.trim() || !apiKey) return;

    debounceTimeout.current = window.setTimeout(async () => {
        setIsLoadingIdeas(true);
        try {
            const newIdeas = await getNewIdeasFromText(selectedGenre.value, storyText, INITIAL_IDEAS_COUNT);
            if (newIdeas.length > 0) {
              setStoryIdeas(newIdeas.map(idea => ({ id: crypto.randomUUID(), text: idea })));
            }
        } catch (err) {
            console.error('Gagal memuat ide dinamis:', err);
        } finally {
            setIsLoadingIdeas(false);
        }
    }, 1200);

    return () => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [storyText, selectedGenre, apiKey, activeView]);


  const handleSelectIdea = useCallback(async (idea: StoryIdea) => {
    if (!apiKey) return;
    setStoryText(prev => prev ? `${prev}\n- ${idea.text}` : `- ${idea.text}`);
    const updatedIdeas = storyIdeas.filter(i => i.id !== idea.id);
    setStoryIdeas(updatedIdeas);

    try {
      const newIdeaText = await getNewIdea(selectedGenre.value, [...updatedIdeas.map(i => i.text), storyText]);
      setStoryIdeas(prev => [...prev, { id: crypto.randomUUID(), text: newIdeaText }]);
    } catch (err) {
      console.error('Gagal memuat ide baru:', err);
    }
  }, [apiKey, selectedGenre, storyText, storyIdeas]);
  
  const handleDismissIdea = useCallback(async (ideaToDismiss: StoryIdea) => {
    if (!apiKey) return;
    const updatedIdeas = storyIdeas.filter(i => i.id !== ideaToDismiss.id);
    setStoryIdeas(updatedIdeas);

    try {
        const newIdeaText = await getNewIdea(selectedGenre.value, updatedIdeas.map(i => i.text));
        setStoryIdeas(prev => [...prev, { id: crypto.randomUUID(), text: newIdeaText }]);
    } catch (err) {
        console.error('Gagal memuat ide baru saat menghapus:', err);
    }
  }, [apiKey, selectedGenre, storyIdeas]);

  const handleGenreChange = (genre: Genre) => {
    setSelectedGenre(genre);
    setStoryText('');
    setFullStory('');
    setGeneratedImages([]);
    setImagePrompts([]);
    setGeneratedVideoUrl(null);
    setGeneratedSceneVideos(new Map());
    setGeneratingSceneVideoIds(new Set());
    setSceneNarrations([]);
    setActiveView('wizard');
  };
  
  const handleSaveApiKey = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem('gemini_api_key', newKey);
    setIsApiKeyModalOpen(false);
  };

  const handleGenerateStory = async () => {
    if (!storyText.trim()) {
      setError('Silakan tulis cerita Anda terlebih dahulu.');
      return;
    }
    if (!characterImage && !characterText.trim()) {
      setError('Silakan deskripsikan karakter Anda atau unggah gambar.');
      return;
    }
    setIsGeneratingStory(true);
    setError(null);
    setFullStory('');
    setGeneratedImages([]);
    setImagePrompts([]);
    setGeneratedVideoUrl(null);
    setGeneratedSceneVideos(new Map());
    setGeneratingSceneVideoIds(new Set());
    setSceneNarrations([]);

    try {
      const story = await generateFullStory(storyText, selectedGenre.value, characterGender);
      setFullStory(story);

      let characterProfile = characterText;
      if (!characterImage && !characterText) {
          characterProfile = await generateCharacterProfile(story, characterGender);
          setCharacterText(characterProfile);
      }
      
      const prompts = await generateImagePrompts(story);
      setImagePrompts(prompts);
      setActiveView('storybook');
      await handleGenerateImages(prompts, characterProfile, characterGender);

    } catch (err) {
      console.error(err);
      setError(`Gagal membuat cerita lengkap: ${err instanceof Error ? err.message : String(err)}`);
      setActiveView('wizard');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handlePolishStory = async () => {
    if (!storyText.trim()) {
        setError('Tidak ada yang perlu dipoles. Tulis sesuatu terlebih dahulu!');
        return;
    }
    setIsPolishing(true);
    setError(null);
    try {
        const polished = await polishStory(storyText, selectedGenre.value);
        setStoryText(polished);
    } catch (err) {
        console.error('Gagal memoles cerita:', err);
        setError(`Gagal memoles cerita: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        setIsPolishing(false);
    }
  };

  const handleGenerateImages = async (prompts: string[], characterProfile: string, gender: Gender) => {
      const characterInfo = characterImage ?? characterProfile;
      if (!prompts || prompts.length === 0 || !characterInfo) {
        setError('Informasi cerita atau karakter tidak lengkap untuk membuat gambar.');
        return;
      }

      const initialImages: GeneratedImage[] = prompts.map(prompt => ({
          id: crypto.randomUUID(), prompt, src: null, isLoading: true,
      }));
      setGeneratedImages(initialImages);

      try {
          const imagePromises = initialImages.map(img => 
              generateImage(img.prompt, characterInfo, imageAspectRatio, gender)
          );
          const resolvedImages = await Promise.all(imagePromises);
          
          setGeneratedImages(currentImages => currentImages.map((img, index) => ({
              ...img, src: resolvedImages[index], isLoading: false,
          })));

      } catch (err) {
          console.error(err);
          setError(`Gagal membuat gambar: ${err instanceof Error ? err.message : String(err)}`);
          setGeneratedImages(initialImages.map(i => ({...i, isLoading: false})));
      }
  };
  
  const handleRegenerateImage = async (imageToRegen: GeneratedImage) => {
    const characterInfo = characterImage ?? characterText;
    if (!characterInfo) return;

    setGeneratedImages(current => current.map(img => 
      img.id === imageToRegen.id ? { ...img, isLoading: true } : img
    ));

    try {
      const newSrc = await generateImage(imageToRegen.prompt, characterInfo, imageAspectRatio, characterGender);
      setGeneratedImages(current => current.map(img => 
        img.id === imageToRegen.id ? { ...img, src: newSrc, isLoading: false } : img
      ));
    } catch (err) {
      console.error(`Gagal meregenerasi gambar ${imageToRegen.id}:`, err);
      setError(`Gagal meregenerasi gambar: ${err instanceof Error ? err.message : String(err)}`);
      setGeneratedImages(current => current.map(img => 
        img.id === imageToRegen.id ? { ...img, isLoading: false } : img
      ));
    }
  };
  
  const handleDownloadAudio = async () => {
      if(!fullStory) return;
      setIsGeneratingAudio(true);
      setError(null);
      try {
        const narrationScript = await extractNarrationFromStory(fullStory);
        if (!narrationScript.trim()) {
          throw new Error("Gagal mengekstrak narasi dari cerita. Mungkin tidak ada narasi yang ditemukan.");
        }
        
        const audioB64 = await generateStoryAudio(narrationScript, selectedVoice);
        if (audioB64) {
          const pcmData = decodeBase64(audioB64);
          const wavBlob = pcmToWavBlob(pcmData, 24000, 1, 16);
          const url = URL.createObjectURL(wavBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'narasi_cerita.wav';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
            throw new Error("Generated audio was empty.");
        }
      } catch (err) {
         console.error('Gagal membuat audio:', err);
         setError(`Gagal membuat audio: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsGeneratingAudio(false);
      }
  };

  const handleGenerateVideo = async () => {
    const firstImage = generatedImages.find(img => img.src && !img.isLoading);
    if (!fullStory || !firstImage) {
        setError("Cerita lengkap dan setidaknya satu gambar diperlukan untuk membuat video.");
        return;
    }

    try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await window.aistudio.openSelectKey();
        }

        setIsGeneratingVideo(true);
        setGeneratedVideoUrl(null);
        setError(null);

        const videoUri = await generateVideoFromStory(fullStory, generatedImages, imageAspectRatio);

        if (!videoUri) {
            throw new Error("Gagal mendapatkan URI video dari API.");
        }
        
        const videoResponse = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
        if (!videoResponse.ok) {
            throw new Error(`Gagal mengunduh video: ${videoResponse.statusText}`);
        }
        const videoBlob = await videoResponse.blob();
        const videoUrl = URL.createObjectURL(videoBlob);
        setGeneratedVideoUrl(videoUrl);

    } catch (err: any) {
        console.error("Gagal membuat video:", err);
        let errorMessage = `Gagal membuat video: ${err instanceof Error ? err.message : String(err)}`;
        
        if (err.message && err.message.includes("Requested entity was not found.")) {
             errorMessage = "Kunci API Video tidak valid. Silakan pilih kunci API yang valid dari dialog.";
             await window.aistudio.openSelectKey();
        }

        setError(errorMessage);
        setGeneratedVideoUrl(null);
    } finally {
        setIsGeneratingVideo(false);
    }
  };

  const handleGenerateVideoForScene = async (imageToProcess: GeneratedImage) => {
    if (!fullStory || !imageToProcess.src) {
      setError("Cerita dan gambar adegan diperlukan untuk membuat video.");
      return;
    }

    try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await window.aistudio.openSelectKey();
        }

        setGeneratingSceneVideoIds(prev => new Set(prev).add(imageToProcess.id));
        setError(null);
        
        let narrations = sceneNarrations;
        if (narrations.length === 0 && imagePrompts.length > 0) {
            narrations = await splitStoryIntoSceneNarrations(fullStory, imagePrompts);
            setSceneNarrations(narrations);
        }
        
        const imageIndex = generatedImages.findIndex(img => img.id === imageToProcess.id);
        if (imageIndex === -1 || !narrations[imageIndex]) {
            throw new Error(`Tidak dapat menemukan narasi untuk adegan ${imageIndex + 1}.`);
        }
        const narration = narrations[imageIndex];

        const videoUri = await generateVideoForScene(narration, imageToProcess, imageAspectRatio);

        if (!videoUri) throw new Error("API tidak mengembalikan URI video.");
        const videoResponse = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
        if (!videoResponse.ok) throw new Error(`Gagal mengunduh video: ${videoResponse.statusText}`);
        const videoBlob = await videoResponse.blob();
        const videoUrl = URL.createObjectURL(videoBlob);

        setGeneratedSceneVideos(prev => new Map(prev).set(imageToProcess.id, videoUrl));
    } catch (err: any) {
        console.error(`Gagal membuat video untuk adegan ${imageToProcess.id}:`, err);
        let errorMessage = `Gagal membuat video: ${err instanceof Error ? err.message : String(err)}`;
        if (err.message && err.message.includes("Requested entity was not found.")) {
             errorMessage = "Kunci API Video tidak valid. Silakan pilih kunci API yang valid dari dialog.";
             await window.aistudio.openSelectKey();
        }
        setError(errorMessage);
    } finally {
        setGeneratingSceneVideoIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(imageToProcess.id);
            return newSet;
        });
    }
  };

  const handleDownloadImages = async () => {
      const zip = new JSZip();
      const imageFiles = generatedImages.filter(img => img.src && !img.isLoading);
      
      if (imageFiles.length === 0) return;

      imageFiles.forEach((img, index) => {
          const base64Data = img.src!.split(',')[1];
          zip.file(`ilustrasi_${index + 1}.png`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ilustrasi_cerita.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };
  
  const handleAffiliateImageChange = (image: CharacterImageData | null, index: number) => {
    setAffiliateImages(prev => {
      const newImages = [...prev];
      newImages[index] = image;
      return newImages;
    });
  };

  const handleGenerateAffiliateIdea = async () => {
    const [characterImage, productImage] = affiliateImages;
    if (!characterImage || !productImage) {
        setError("Silakan unggah gambar karakter dan produk terlebih dahulu untuk mendapatkan ide.");
        return;
    }
    setIsGeneratingAffiliateIdea(true);
    setError(null);
    try {
        const scenario = await generateAffiliateScenario(characterImage, productImage);
        setAffiliateScenario(scenario);
    } catch (err) {
        console.error("Gagal membuat ide skenario:", err);
        setError(`Gagal membuat ide: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        setIsGeneratingAffiliateIdea(false);
    }
  };
  
  const handleGenerateAffiliateContent = async () => {
    const validImages = affiliateImages.filter(img => img !== null) as CharacterImageData[];

    if (validImages.length < 2) {
        setError("Silakan unggah gambar karakter dan produk.");
        return;
    }
    
    setIsGeneratingAffiliate(true);
    setError(null);
    setAffiliateGeneratedImages(Array(7).fill(null).map(() => ({ id: crypto.randomUUID(), prompt: '', src: null, isLoading: true })));
    setAffiliateVideoJsons([]);

    try {
        const { images, videoJson } = await generateAffiliatePackage(validImages[0], validImages[1], affiliateLanguage);
        
        setAffiliateVideoJsons(videoJson.map(json => JSON.stringify(json, null, 2)));
        
        setAffiliateGeneratedImages(current => current.map((img, index) => ({
            ...(img as GeneratedImage),
            src: images[index],
            isLoading: false,
        })));
    } catch (err) {
        console.error("Gagal membuat paket afiliasi:", err);
        setError(`Gagal membuat konten afiliasi: ${err instanceof Error ? err.message : String(err)}`);
        setAffiliateGeneratedImages(Array(7).fill(null));
    } finally {
        setIsGeneratingAffiliate(false);
    }
  };

  const handleDownloadAffiliateImages = async () => {
      const zip = new JSZip();
      const imageFiles = affiliateGeneratedImages.filter(img => img && img.src && !img.isLoading);
      
      if (imageFiles.length === 0) return;

      imageFiles.forEach((img, index) => {
          const base64Data = img!.src!.split(',')[1];
          zip.file(`konten_afiliasi_${index + 1}.png`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'makasih emha ganteng.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };


  return (
    <>
    <ApiKeyModal 
        isOpen={isApiKeyModalOpen}
        currentApiKey={apiKey}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSave={handleSaveApiKey}
    />
    <div className="min-h-screen font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Header 
          onSettingsClick={() => setIsApiKeyModalOpen(true)}
          theme={theme}
          onThemeToggle={handleThemeToggle}
        />

        <main className="mt-8">
          <div className="border-b border-slate-300 dark:border-slate-700 mb-6 transition-colors duration-300">
            <nav className="flex -mb-px flex-wrap">
              <TabButton name="Generator Cerita" active={activeView === 'wizard'} onClick={() => setActiveView('wizard')} />
              <TabButton name="UGC IMG & PROMPT" active={activeView === 'imageAffiliate'} onClick={() => setActiveView('imageAffiliate')} />
              <TabButton name="Buku Cerita" active={activeView === 'storybook'} onClick={() => setActiveView('storybook')} disabled={!fullStory} />
              <TabButton name="About" active={activeView === 'about'} onClick={() => setActiveView('about')} />
            </nav>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300 px-4 py-3 rounded-lg relative mb-6 transition-colors duration-300" role="alert">
              <strong className="font-bold">Kesalahan: </strong>
              <span className="block sm:inline">{error}</span>
              <button type="button" onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Tutup">
                  <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Tutup</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
              </button>
            </div>
          )}

          {activeView === 'wizard' && (
            <StoryWizard
              genres={GENRES}
              selectedGenre={selectedGenre}
              onGenreChange={handleGenreChange}
              storyIdeas={storyIdeas}
              isLoadingIdeas={isLoadingIdeas}
              onSelectIdea={handleSelectIdea}
              storyText={storyText}
              onStoryTextChange={setStoryText}
              onDismissIdea={handleDismissIdea}
              isStoryReady={storyText.trim().length > 0 && !!apiKey}
              onGenerateStory={handleGenerateStory}
              isGeneratingStory={isGeneratingStory}
              onPolishStory={handlePolishStory}
              isPolishing={isPolishing}
              characterImage={characterImage}
              onCharacterImageChange={setCharacterImage}
              characterText={characterText}
              onCharacterTextChange={setCharacterText}
              characterGender={characterGender}
              onCharacterGenderChange={setCharacterGender}
              imageAspectRatio={imageAspectRatio}
              onImageAspectRatioChange={setImageAspectRatio}
            />
          )}

          {activeView === 'imageAffiliate' && (
            <ImageAffiliateView 
              baseImages={affiliateImages}
              onBaseImageChange={handleAffiliateImageChange}
              onGenerate={handleGenerateAffiliateContent}
              isGenerating={isGeneratingAffiliate}
              generatedImages={affiliateGeneratedImages}
              videoJsons={affiliateVideoJsons}
              onDownloadAll={handleDownloadAffiliateImages}
              onGenerateIdea={handleGenerateAffiliateIdea}
              isGeneratingIdea={isGeneratingAffiliateIdea}
              languages={UGC_LANGUAGES}
              selectedLanguage={affiliateLanguage}
              onLanguageChange={setAffiliateLanguage}
            />
          )}
        
          {activeView === 'storybook' && (
            <StorybookView
              fullStory={fullStory}
              generatedImages={generatedImages}
              onRegenerateImage={handleRegenerateImage}
              isGeneratingAudio={isGeneratingAudio}
              onDownloadAudio={handleDownloadAudio}
              onDownloadImages={handleDownloadImages}
              voiceOptions={VOICE_OPTIONS}
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              isGeneratingVideo={isGeneratingVideo}
              generatedVideoUrl={generatedVideoUrl}
              onGenerateVideo={handleGenerateVideo}
              onGenerateVideoForScene={handleGenerateVideoForScene}
              generatedSceneVideos={generatedSceneVideos}
              generatingSceneVideoIds={generatingSceneVideoIds}
            />
          )}

          {activeView === 'about' && (
            <AboutView />
          )}

        </main>
      </div>
    </div>
    </>
  );
};

export default App;