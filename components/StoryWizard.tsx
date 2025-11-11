import React from 'react';
import { Genre, StoryIdea, CharacterImageData, Gender, AspectRatio } from '../types';
import { PlusIcon, SparklesIcon, XIcon, WandIcon, LandscapeIcon, PortraitIcon } from './Icons';
import { Spinner } from './common/Spinner';
import { CharacterCreator } from './CharacterCreator';
import { ToggleButton } from './common/ToggleButton';

interface StoryWizardProps {
  genres: Genre[];
  selectedGenre: Genre;
  onGenreChange: (genre: Genre) => void;
  storyIdeas: StoryIdea[];
  isLoadingIdeas: boolean;
  onSelectIdea: (idea: StoryIdea) => void;
  storyText: string;
  onStoryTextChange: (text: string) => void;
  onDismissIdea: (idea: StoryIdea) => void;
  isStoryReady: boolean;
  onGenerateStory: () => void;
  isGeneratingStory: boolean;
  onPolishStory: () => void;
  isPolishing: boolean;
  characterImage: CharacterImageData | null;
  onCharacterImageChange: (imageData: CharacterImageData | null) => void;
  onCharacterTextChange: (text: string) => void;
  characterText: string;
  characterGender: Gender;
  onCharacterGenderChange: (gender: Gender) => void;
  imageAspectRatio: AspectRatio;
  onImageAspectRatioChange: (ratio: AspectRatio) => void;
}

export const StoryWizard: React.FC<StoryWizardProps> = ({
  genres,
  selectedGenre,
  onGenreChange,
  storyIdeas,
  isLoadingIdeas,
  onSelectIdea,
  storyText,
  onStoryTextChange,
  onDismissIdea,
  isStoryReady,
  onGenerateStory,
  isGeneratingStory,
  onPolishStory,
  isPolishing,
  characterImage,
  onCharacterImageChange,
  onCharacterTextChange,
  characterText,
  characterGender,
  onCharacterGenderChange,
  imageAspectRatio,
  onImageAspectRatioChange,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
      {/* Left Column: Story Building */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-lg transition-colors duration-300">
        <h2 className="text-xl font-semibold text-cyan-700 dark:text-cyan-400 mb-1">Langkah 1: Pilih Genre Anda</h2>
        <div className="flex flex-wrap gap-2 mb-6">
          {genres.map(genre => (
            <ToggleButton
              key={genre.value}
              name={genre.name}
              onClick={() => onGenreChange(genre)}
              active={selectedGenre.value === genre.value}
            >
              {genre.emoji}
            </ToggleButton>
          ))}
        </div>

        <h2 className="text-xl font-semibold text-cyan-700 dark:text-cyan-400 mb-1">Langkah 2: Cerita & Karakter</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm">Tentukan karakter Anda dan tulis draf cerita.</p>
        
        <CharacterCreator 
          characterImage={characterImage}
          onCharacterImageChange={onCharacterImageChange}
          onCharacterTextChange={onCharacterTextChange}
          characterText={characterText}
          gender={characterGender}
          onGenderChange={onCharacterGenderChange}
        />

        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg min-h-[200px] border border-slate-300 dark:border-slate-600 flex-grow flex flex-col focus-within:ring-2 focus-within:ring-cyan-500 transition-shadow mt-4 transition-colors duration-300">
            <textarea
                value={storyText}
                onChange={(e) => onStoryTextChange(e.target.value)}
                className="bg-transparent p-4 w-full h-full flex-grow resize-none text-slate-700 dark:text-slate-200 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500"
                placeholder="Ketik plot cerita Anda di sini, atau pilih ide dari kanan..."
            />
        </div>
        
        <div className="mt-6">
            <h3 className="text-xl font-semibold text-cyan-700 dark:text-cyan-400 mb-2">Langkah 3: Pilih Mode Gambar</h3>
            <div className="grid grid-cols-2 gap-4">
                <AspectRatioButton
                    label="Landscape"
                    value="16:9"
                    icon={<LandscapeIcon className="h-8 w-8 mx-auto mb-1 text-slate-500 dark:text-slate-400 group-hover:text-cyan-600 transition-colors"/>}
                    active={imageAspectRatio === '16:9'}
                    onClick={() => onImageAspectRatioChange('16:9')}
                />
                <AspectRatioButton
                    label="Portrait"
                    value="9:16"
                    icon={<PortraitIcon className="h-8 w-8 mx-auto mb-1 text-slate-500 dark:text-slate-400 group-hover:text-cyan-600 transition-colors"/>}
                    active={imageAspectRatio === '9:16'}
                    onClick={() => onImageAspectRatioChange('9:16')}
                />
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <button
                type="button"
                onClick={onPolishStory}
                disabled={!isStoryReady || isPolishing || isGeneratingStory}
                className="w-full bg-amber-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-500 dark:disabled:text-slate-400 shadow-lg"
            >
                {isPolishing ? (
                    <>
                        <Spinner className="h-5 w-5 mr-3"/>
                        Memoles...
                    </>
                ) : (
                    <>
                        <WandIcon className="h-5 w-5 mr-3"/>
                        Poles Tulisan
                    </>
                )}
            </button>
            <button
                type="button"
                onClick={onGenerateStory}
                disabled={!isStoryReady || isGeneratingStory || isPolishing}
                className="w-full bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-cyan-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-500 dark:disabled:text-slate-400 shadow-lg"
            >
                {isGeneratingStory ? (
                    <>
                        <Spinner className="h-5 w-5 mr-3"/>
                        Merangkai Epik...
                    </>
                ) : (
                    <>
                        <SparklesIcon className="h-5 w-5 mr-3"/>
                        Buat Cerita
                    </>
                )}
            </button>
        </div>
      </div>

      {/* Right Column: Idea Pool */}
      <div className="bg-indigo-700 dark:bg-slate-900 p-6 rounded-2xl border border-indigo-800 dark:border-slate-700 shadow-sm transition-colors duration-300">
        <h2 className="text-xl font-semibold text-indigo-300 mb-1">Kumpulan Ide</h2>
        <p className="text-indigo-400 mb-4 text-sm">Klik sebuah ide untuk menambahkannya ke cerita Anda.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isLoadingIdeas ? (
            Array.from({ length: 16 }).map((_, index) => (
                <div key={index} className="bg-indigo-500/50 dark:bg-slate-800 h-24 rounded-lg animate-pulse"></div>
            ))
          ) : (
            storyIdeas.map(idea => (
              <div key={idea.id} className="relative group">
                <button
                  type="button"
                  onClick={() => onSelectIdea(idea)}
                  className="bg-indigo-500 text-white text-left p-3 rounded-lg flex flex-col justify-between w-full h-24 text-sm hover:bg-indigo-600 hover:ring-2 hover:ring-indigo-300 transition-all duration-200 cursor-pointer dark:bg-indigo-700 dark:hover:bg-indigo-600"
                >
                  <span className="pr-4">{idea.text}</span>
                  <PlusIcon className="h-5 w-5 text-indigo-200 self-end group-hover:text-indigo-100 dark:text-indigo-300 dark:group-hover:text-indigo-200 transition-colors"/>
                </button>
                 <button 
                    type="button"
                    onClick={() => onDismissIdea(idea)}
                    aria-label="Hapus ide"
                    className="absolute top-1 right-1 p-1 rounded-full bg-white/20 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all z-10 dark:hover:bg-red-600"
                >
                    <XIcon className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const AspectRatioButton: React.FC<{
    label: string;
    value: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
}> = ({ label, value, icon, active, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`group p-4 rounded-lg border-2 transition-all duration-200 text-center ${
            active
                ? 'bg-cyan-50 dark:bg-cyan-900/50 border-cyan-500 shadow-md'
                : 'bg-white hover:bg-slate-50 border-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:border-slate-600'
        }`}
    >
        {icon}
        <p className={`text-sm font-semibold ${active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-600 dark:text-slate-300'}`}>{label}</p>
        <p className={`text-xs ${active ? 'text-cyan-500' : 'text-slate-400 dark:text-slate-500'}`}>{value}</p>
    </button>
);