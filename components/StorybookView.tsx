import React from 'react';
import { DownloadIcon, RefreshIcon, VideoCameraIcon } from './Icons';
import { Spinner } from './common/Spinner';
import { GeneratedImage, Voice, VoiceOption } from '../types';
import { ImageLoadingSkeleton } from './common/ImageLoadingSkeleton';

interface StorybookViewProps {
  fullStory: string;
  generatedImages: GeneratedImage[];
  isGeneratingAudio: boolean;
  onDownloadAudio: () => void;
  onDownloadImages: () => void;
  onRegenerateImage: (image: GeneratedImage) => void;
  selectedVoice: Voice;
  onVoiceChange: (voice: Voice) => void;
  voiceOptions: VoiceOption[];
  isGeneratingVideo: boolean;
  generatedVideoUrl: string | null;
  onGenerateVideo: () => void;
  onGenerateVideoForScene: (image: GeneratedImage) => void;
  generatedSceneVideos: Map<string, string>;
  generatingSceneVideoIds: Set<string>;
}

export const StorybookView: React.FC<StorybookViewProps> = ({
  fullStory,
  generatedImages,
  isGeneratingAudio,
  onDownloadAudio,
  onDownloadImages,
  onRegenerateImage,
  selectedVoice,
  onVoiceChange,
  voiceOptions,
  isGeneratingVideo,
  generatedVideoUrl,
  onGenerateVideo,
  onGenerateVideoForScene,
  generatedSceneVideos,
  generatingSceneVideoIds,
}) => {
  const hasImages = generatedImages.some(img => img.src && !img.isLoading);

  return (
    <div className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg animate-fade-in transition-colors duration-300">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-3">
            <h2 className="text-2xl font-bold text-cyan-700 dark:text-cyan-400 shrink-0">Buku Cerita Anda</h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:justify-end flex-wrap">
                <button
                    onClick={onGenerateVideo}
                    disabled={isGeneratingVideo || isGeneratingAudio || !hasImages}
                    className="w-full sm:w-auto bg-violet-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-violet-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-500 dark:disabled:text-slate-400"
                >
                    {isGeneratingVideo ? (
                       <>
                        <Spinner className="h-5 w-5 mr-2"/>
                        Membuat Video...
                       </>
                    ) : (
                       <>
                        <VideoCameraIcon className="h-5 w-5 mr-2"/>
                        Buat Video Cerita
                       </>
                    )}
                </button>
                <div className="relative w-full sm:w-auto">
                    <select
                      value={selectedVoice}
                      onChange={(e) => onVoiceChange(e.target.value as Voice)}
                      className="w-full sm:w-auto bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-4 pr-8 rounded-lg border border-slate-300 dark:border-slate-600 appearance-none focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all cursor-pointer"
                      aria-label="Pilih suara narator"
                    >
                      {voiceOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 dark:text-slate-300">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>

                <button
                    onClick={onDownloadAudio}
                    disabled={isGeneratingAudio || isGeneratingVideo}
                    className="w-full sm:w-auto bg-amber-500 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-500 dark:disabled:text-slate-400"
                >
                    {isGeneratingAudio ? (
                       <>
                        <Spinner className="h-5 w-5 mr-2"/>
                        Membuat Audio...
                       </>
                    ) : (
                       <>
                        <DownloadIcon className="h-5 w-5 mr-2"/>
                        Unduh Audio
                       </>
                    )}
                </button>
                 <button
                    onClick={onDownloadImages}
                    disabled={!hasImages}
                    className="w-full sm:w-auto bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-cyan-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                    <DownloadIcon className="h-5 w-5 mr-2"/>
                    Unduh Ilustrasi
                </button>
            </div>
        </div>

        {(isGeneratingVideo || generatedVideoUrl) && (
            <div className="mb-8">
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">Video Cerita Lengkap</h3>
                {isGeneratingVideo && (
                    <div className="aspect-video w-full bg-slate-200 dark:bg-slate-700 rounded-lg flex flex-col items-center justify-center text-center p-4">
                        <Spinner className="h-8 w-8 text-violet-500 mb-4"/>
                        <p className="font-semibold text-slate-700 dark:text-slate-200">Video sedang dibuat...</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Proses ini mungkin memakan waktu beberapa menit. Mohon jangan tutup halaman ini.</p>
                    </div>
                )}
                {generatedVideoUrl && !isGeneratingVideo && (
                    <div className="relative">
                        <video src={generatedVideoUrl} controls className="w-full aspect-video rounded-lg bg-black"></video>
                        <a 
                            href={generatedVideoUrl} 
                            download="video_cerita.mp4"
                            className="absolute top-4 right-4 bg-black/50 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-black/80"
                        >
                            <DownloadIcon className="h-5 w-5 mr-2"/>
                            Unduh Video
                        </a>
                    </div>
                )}
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Story Column */}
            <div>
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">Narasi Lengkap</h3>
                 <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg h-[400px] lg:h-[calc(100%-40px)] overflow-y-auto border border-slate-200 dark:border-slate-700 prose prose-slate prose-sm max-w-none transition-colors duration-300">
                    <pre className="whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300">{fullStory}</pre>
                 </div>
            </div>
            {/* Images Column */}
            <div>
                 <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">Adegan Visual</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {generatedImages.map((img) => {
                       const isGeneratingSceneVideo = generatingSceneVideoIds.has(img.id);
                       const sceneVideoUrl = generatedSceneVideos.get(img.id);
                       const isImageLoading = img.isLoading || !img.src;

                       return (
                         <div key={img.id} className="relative group aspect-video">
                            {isImageLoading ? (
                                <ImageLoadingSkeleton />
                            ) : isGeneratingSceneVideo ? (
                                <>
                                 <img src={img.src!} alt={`Generating video for scene: ${img.prompt}`} className="rounded-lg object-cover w-full h-full border border-slate-200 dark:border-slate-600"/>
                                 <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-lg text-white p-2 text-center">
                                    <Spinner className="h-6 w-6 mb-2"/>
                                    <p className="text-xs font-semibold">Membuat video...</p>
                                 </div>
                                </>
                            ) : sceneVideoUrl ? (
                                <video src={sceneVideoUrl} controls className="w-full h-full aspect-video rounded-lg bg-black object-cover"></video>
                            ) : (
                                <>
                                    <img src={img.src} alt={`Generated scene for: ${img.prompt}`} className="rounded-lg object-cover w-full h-full border border-slate-200 dark:border-slate-600"/>
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                                        <button
                                            onClick={() => onRegenerateImage(img)}
                                            className="p-2 bg-white/20 rounded-full text-white hover:bg-white/40 backdrop-blur-sm"
                                            aria-label="Regenerate image"
                                        >
                                            <RefreshIcon className="h-5 w-5"/>
                                        </button>
                                        <button
                                            onClick={() => onGenerateVideoForScene(img)}
                                            className="p-2 bg-white/20 rounded-full text-white hover:bg-white/40 backdrop-blur-sm"
                                            aria-label="Generate video for this scene"
                                        >
                                            <VideoCameraIcon className="h-5 w-5"/>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                       )
                    })}
                </div>
            </div>
        </div>
    </div>
  );
};