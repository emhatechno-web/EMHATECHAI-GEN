import React from 'react';
import { CharacterImageData, GeneratedImage, LanguageOption } from '../types';
import { SparklesIcon, DownloadIcon } from './Icons';
import { Spinner } from './common/Spinner';
import { ImageLoadingSkeleton } from './common/ImageLoadingSkeleton';
import { JsonDisplay } from './common/JsonDisplay';
import { ImageUploader } from './common/ImageUploader';

interface ImageAffiliateViewProps {
    baseImages: (CharacterImageData | null)[];
    onBaseImageChange: (image: CharacterImageData | null, index: number) => void;
    isGenerating: boolean;
    onGenerate: () => void;
    generatedImages: (GeneratedImage | null)[];
    videoJsons: string[];
    onDownloadAll: () => void;
    onGenerateIdea: () => void;
    isGeneratingIdea: boolean;
    languages: LanguageOption[];
    selectedLanguage: string;
    onLanguageChange: (language: string) => void;
}

export const ImageAffiliateView: React.FC<ImageAffiliateViewProps> = ({
    baseImages,
    onBaseImageChange,
    isGenerating,
    onGenerate,
    generatedImages,
    videoJsons,
    onDownloadAll,
    onGenerateIdea,
    isGeneratingIdea,
    languages,
    selectedLanguage,
    onLanguageChange,
}) => {
    const isReadyToGenerate = baseImages[0] && baseImages[1];
    const hasImages = generatedImages.some(img => img && img.src && !img.isLoading);

    return (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Column */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg flex flex-col gap-6">
                    <div>
                         <h2 className="text-xl font-semibold text-cyan-700 dark:text-cyan-400 mb-4">Langkah 1: Konfigurasi</h2>
                        <div className="flex flex-col gap-4">
                           <ImageUploader
                                image={baseImages[0]}
                                onImageChange={(newImage) => onBaseImageChange(newImage, 0)}
                                label="Gambar Karakter"
                            />
                             <ImageUploader
                                image={baseImages[1]}
                                onImageChange={(newImage) => onBaseImageChange(newImage, 1)}
                                label="Gambar Produk"
                            />
                             <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Bahasa Prompt Video</p>
                                <div className="relative">
                                    <select
                                        value={selectedLanguage}
                                        onChange={(e) => onLanguageChange(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-3 px-4 pr-10 rounded-lg border border-slate-300 dark:border-slate-600 appearance-none focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all cursor-pointer"
                                        aria-label="Pilih bahasa untuk prompt video"
                                    >
                                        {languages.map(lang => (
                                            <option key={lang.value} value={lang.value}>{lang.name}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-700 dark:text-slate-300">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-auto">
                         <h2 className="text-xl font-semibold text-cyan-700 dark:text-cyan-400 mb-4">Langkah 2: Buat Konten</h2>
                        <p className="text-xs text-center text-slate-500 dark:text-slate-400 mb-2">Mode Potret (9:16) akan digunakan untuk konten UGC.</p>
                         <button
                            onClick={onGenerate}
                            disabled={!isReadyToGenerate || isGenerating}
                            className="w-full bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-cyan-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-500 dark:disabled:text-slate-400 shadow-lg"
                        >
                            {isGenerating ? (
                                <>
                                    <Spinner className="h-5 w-5 mr-3"/>
                                    Membuat Konten...
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="h-5 w-5 mr-3"/>
                                    Buat 7 Gambar & Prompt Video
                                </>
                            )}
                        </button>
                    </div>
                </div>
                 {/* Output Column */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                         <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300">Hasil Konten UGC</h2>
                         <button
                            onClick={onDownloadAll}
                            disabled={!hasImages}
                            className="bg-cyan-600 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-cyan-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-sm"
                        >
                            <DownloadIcon className="h-4 w-4 mr-2"/>
                            Unduh Gambar
                        </button>
                    </div>
                     <div className="flex flex-col gap-6 overflow-y-auto max-h-[70vh] pr-2">
                        {generatedImages.map((img, index) => (
                             <div key={img?.id || index}>
                                <h3 className="font-semibold text-slate-600 dark:text-slate-400 mb-2">Adegan UGC {index + 1}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                                    <div className="aspect-[9/16]">
                                        {!img || img.isLoading || !img.src ? (
                                            <ImageLoadingSkeleton aspectRatio="portrait" />
                                        ) : (
                                            <img src={img.src} alt={`Generated scene ${index + 1}`} className="rounded-lg object-cover w-full h-full border border-slate-200 dark:border-slate-600"/>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                         <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Prompt Video</p>
                                         {isGenerating && !videoJsons[index] ? (
                                            <div className="bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 p-4 rounded-lg h-full border border-slate-200 dark:border-slate-700">Menghasilkan...</div>
                                         ) : videoJsons[index] ? (
                                            <JsonDisplay jsonString={videoJsons[index]} />
                                         ) : (
                                             <div className="bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 p-4 rounded-lg h-full border border-slate-200 dark:border-slate-700 text-center">Prompt video akan muncul di sini.</div>
                                         )}
                                    </div>
                                </div>
                             </div>
                        ))}
                        {isGenerating && generatedImages.every(img => !img) && (
                           <div>
                                <h3 className="font-semibold text-slate-600 dark:text-slate-400 mb-2">Membuat Adegan UGC...</h3>
                               <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                   {Array.from({ length: 7 }).map((_, index) => <ImageLoadingSkeleton key={index} aspectRatio="portrait" />)}
                               </div>
                           </div>
                        )}
                        {!isGenerating && generatedImages.every(img => !img) && (
                            <div className="flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400 h-full py-10">
                                <SparklesIcon className="h-12 w-12 text-slate-400 dark:text-slate-500 mb-4" />
                                <h3 className="font-semibold text-lg text-slate-600 dark:text-slate-300">Siap untuk Berkreasi</h3>
                                <p>Unggah aset Anda dan klik 'Buat' untuk melihat keajaibannya.</p>
                            </div>
                        )}
                     </div>
                </div>

            </div>
        </div>
    );
};