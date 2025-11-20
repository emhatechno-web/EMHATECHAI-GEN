
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { AspectRatio, CharacterImageData, Gender, Voice, LyricLine, LyricData, VeoModel, VideoResolution } from '../types';

/**
 * Mendefinisikan status kunci API untuk pelacakan.
 */
type ApiKeyStatus = 'active' | 'invalid';

interface ApiKey {
  key: string;
  status: ApiKeyStatus;
}

const USER_API_KEY_STORAGE_KEY = 'gemini_user_api_keys';

/**
 * Manajer terpusat untuk menangani kunci API.
 * Memprioritaskan daftar kunci yang disediakan pengguna dari localStorage,
 * jika tidak ada, kembali ke sistem rotasi kunci dari variabel lingkungan.
 */
export const apiKeyManager = {
  keys: [] as ApiKey[],
  currentIndex: 0,
  
  init() {
    let userApiKeys: string[] = [];
    
    // Safely try to get keys from localStorage
    try {
        if (typeof localStorage !== 'undefined') {
            const userApiKeysJson = localStorage.getItem(USER_API_KEY_STORAGE_KEY);
            if (userApiKeysJson) {
                try {
                    const parsed = JSON.parse(userApiKeysJson);
                    if (Array.isArray(parsed)) {
                        userApiKeys = parsed;
                    }
                } catch (e) {
                    console.error("Gagal mem-parsing kunci API pengguna dari localStorage:", e);
                    // Safely try to remove bad data
                    try { localStorage.removeItem(USER_API_KEY_STORAGE_KEY); } catch (err) {}
                }
            }
        }
    } catch (e) {
        console.warn("LocalStorage access blocked or unavailable:", e);
    }

    if (userApiKeys.length > 0) {
      this.keys = userApiKeys.map(key => ({ key, status: 'active' }));
      console.log(`Menggunakan ${userApiKeys.length} kunci API yang disediakan pengguna dari localStorage.`);
    } else {
      let keyString = '';
      try {
        // Defensive check to prevent crash if process is undefined
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            keyString = process.env.API_KEY;
        }
      } catch (e) {
        console.warn("Could not access process.env.API_KEY", e);
      }

      this.keys = keyString.split(',').map(k => k.trim()).filter(Boolean).map(key => ({ key, status: 'active' }));
      
      if (this.keys.length === 0) {
        console.warn("Tidak ada kunci API pengguna yang ditemukan, dan process.env.API_KEY tidak diatur atau kosong.");
      } else {
        console.log("Menggunakan kunci API dari variabel lingkungan.");
      }
    }
    this.currentIndex = 0;
  },

  setUserApiKeys(userKeys: string[]) {
    const trimmedKeys = userKeys.map(k => k.trim()).filter(Boolean);
    
    try {
        if (typeof localStorage !== 'undefined') {
            if (trimmedKeys.length > 0) {
                localStorage.setItem(USER_API_KEY_STORAGE_KEY, JSON.stringify(trimmedKeys));
            } else {
                localStorage.removeItem(USER_API_KEY_STORAGE_KEY);
            }
        }
    } catch (e) {
        console.warn("Failed to save API keys to localStorage:", e);
    }
    
    this.init();
  },

  getUserApiKeys(): string[] {
    try {
        if (typeof localStorage !== 'undefined') {
            const userApiKeysJson = localStorage.getItem(USER_API_KEY_STORAGE_KEY);
            if (userApiKeysJson) {
                try {
                    const parsed = JSON.parse(userApiKeysJson);
                    return Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                    return [];
                }
            }
        }
    } catch (e) {
        return [];
    }
    return [];
  },
  
  getNextAvailableKey(): { key: string, index: number } | null {
    if (this.keys.length === 0) return null;
    const activeKeys = this.keys
        .map((k, i) => ({ ...k, originalIndex: i }))
        .filter(k => k.status === 'active');

    if (activeKeys.length === 0) return null;

    this.currentIndex = (this.currentIndex + 1) % activeKeys.length;
    const keyInfo = activeKeys[this.currentIndex];
    return { key: keyInfo.key, index: keyInfo.originalIndex };
  },

  markKeyAsInvalid(keyIndex: number) {
    if (this.keys[keyIndex] && this.keys[keyIndex].status !== 'invalid') {
      this.keys[keyIndex].status = 'invalid';
      console.error(`Kunci API pada indeks ${keyIndex} telah ditandai sebagai tidak valid dan akan dilewati.`);
    }
  },
};

// Initialize immediately, but now safely
apiKeyManager.init();

function getAiClient(apiKey: string): GoogleGenAI {
    return new GoogleGenAI({ apiKey });
}

export class AllApiKeysFailedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AllApiKeysFailedError";
    }
}

function isInvalidApiKeyError(error: any): boolean {
    const message = error?.message || '';
    return message.includes('API key not valid') || 
           message.includes('API_KEY_INVALID') ||
           message.includes('permission denied') ||
           message.includes('403');
}

function isRetryableError(error: any): boolean {
    const message = error?.message || '';
    return message.includes('rate limit') ||
           message.includes('quota') ||
           message.includes('RESOURCE_EXHAUSTED') ||
           message.includes('server error') ||
           message.includes('500') ||
           message.includes('503');
}

async function callWithApiKeyRotation<T>(apiCall: (client: GoogleGenAI, currentKey: string) => Promise<T>): Promise<T> {
  const isUserKey = apiKeyManager.getUserApiKeys().length > 0;

  const activeKeyIndexes = apiKeyManager.keys
    .map((k, i) => ({ status: k.status, index: i }))
    .filter(k => k.status === 'active')
    .map(k => k.index);

  if (activeKeyIndexes.length === 0) {
    if (isUserKey) {
        throw new AllApiKeysFailedError("Semua kunci API yang Anda berikan tampaknya tidak valid. Silakan masukkan kunci yang benar di pengaturan.");
    }
    if (apiKeyManager.keys.length > 0) {
      throw new AllApiKeysFailedError("Semua kunci API yang disediakan oleh sistem telah gagal. Coba masukkan kunci API Anda sendiri di pengaturan.");
    }
    throw new Error("Tidak ada kunci API yang dikonfigurasi. Harap masukkan kunci API Anda di pengaturan.");
  }
  
  let lastRetryableError: Error | undefined;
  
  const startKeyInfo = apiKeyManager.getNextAvailableKey();
  if (!startKeyInfo) {
    throw new AllApiKeysFailedError("Tidak ada kunci API aktif yang tersedia untuk dicoba.");
  }

  const startIndexInActiveList = activeKeyIndexes.indexOf(startKeyInfo.index);
  const rotatedIndexes = [...activeKeyIndexes.slice(startIndexInActiveList), ...activeKeyIndexes.slice(0, startIndexInActiveList)];

  for (const keyIndex of rotatedIndexes) {
    const currentKey = apiKeyManager.keys[keyIndex].key;
    const client = getAiClient(currentKey);

    try {
      return await apiCall(client, currentKey);
    } catch (error: any) {
      if (isInvalidApiKeyError(error)) {
        console.warn(`Panggilan API gagal karena kunci tidak valid untuk indeks kunci ${keyIndex}. Menandai sebagai tidak valid.`);
        apiKeyManager.markKeyAsInvalid(keyIndex);
        lastRetryableError = error;
        continue;
      }
      
      if (isRetryableError(error)) {
        console.warn(`Panggilan API gagal dengan kesalahan yang dapat dicoba kembali untuk indeks kunci ${keyIndex}: ${error.message}. Mencoba kunci berikutnya.`);
        lastRetryableError = error;
        continue;
      }

      console.error(`Panggilan API gagal dengan kesalahan yang tidak dapat dicoba kembali: ${error.message}. Permintaan akan gagal sekarang.`);
      throw error;
    }
  }
  
  if (isUserKey) {
    throw new AllApiKeysFailedError(`Semua kunci API yang Anda berikan gagal. Kesalahan terakhir: ${lastRetryableError?.message || 'Tidak diketahui'}. Silakan periksa kunci Anda.`);
  }
  throw new AllApiKeysFailedError(`Semua ${activeKeyIndexes.length} kunci API sistem aktif telah gagal. Kesalahan terakhir: ${lastRetryableError?.message || 'Tidak diketahui'}. Coba masukkan kunci API Anda sendiri.`);
}

function cleanJsonText(text: string): string {
    // Remove markdown code blocks (```json ... ``` or ``` ...)
    return text.replace(/```(json)?/g, '').replace(/```/g, '').trim();
}

export async function getInitialIdeas(genre: string, count: number): Promise<string[]> {
  return callWithApiKeyRotation(async (client) => {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Buat daftar ${count} ide cerita pendek satu kalimat untuk video bergenre ${genre}. Ide-ide tersebut harus kreatif, inspiratif, dan cocok untuk animasi gaya Disney Pixar. Kembalikan HANYA objek JSON yang valid yang berisi daftar ide dalam kunci "ideas".`,
      config: {
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.OBJECT,
              properties: {
                  ideas: {
                      type: Type.ARRAY,
                      items: {
                          type: Type.STRING
                      }
                  }
              },
              required: ["ideas"],
          }
      }
    });
    const json = JSON.parse(cleanJsonText(response.text || "{}"));
    if (!json.ideas) throw new Error("Struktur JSON tidak valid yang diterima dari AI untuk ide awal.");
    return json.ideas;
  });
}

export async function getNewIdea(genre: string, existingIdeas: string[]): Promise<string> {
    return callWithApiKeyRotation(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Buat ide cerita baru yang unik, satu kalimat untuk video bergenre ${genre}. Ide ini harus berbeda dari ide-ide yang sudah ada: ${JSON.stringify(existingIdeas)}. Berikan HANYA teks ide baru, tanpa awalan atau format tambahan.`,
        });
        return (response.text || "").trim();
    });
}

export async function getNewIdeasFromText(genre: string, storyText: string, count: number): Promise<string[]> {
    return callWithApiKeyRotation(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Berdasarkan plot cerita yang sedang berkembang ini dalam genre ${genre}:\n\n---\n${storyText}\n---\n\nBuat daftar ${count} ide tindak lanjut yang menarik, masing-masing dalam satu kalimat. Ide-ide harus melanjutkan cerita secara logis. Kembalikan HANYA objek JSON yang valid yang berisi daftar ide dalam kunci "ideas".`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        ideas: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["ideas"],
                }
            }
        });
        const json = JSON.parse(cleanJsonText(response.text || "{}"));
        if (!json.ideas) throw new Error("Struktur JSON tidak valid yang diterima dari AI untuk ide dinamis.");
        return json.ideas;
    });
}

export async function polishStory(storyText: string, genre: string): Promise<string> {
  return callWithApiKeyRotation(async (client) => {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Bertindaklah sebagai editor cerita profesional untuk genre ${genre}. Harap poles dan tingkatkan draf cerita berikut agar lebih menarik, mengalir dengan baik, dan memiliki dampak emosional yang lebih kuat. Perbaiki tata bahasa dan pilihan kata, tetapi pertahankan inti plot aslinya.\n\nCERITA ASLI:\n${storyText}\n\nBerikan HANYA versi cerita yang telah dipoles tanpa komentar tambahan.`,
    });
    return (response.text || "").trim();
  });
}

export async function generateFullStory(storyText: string, genre: string, gender: Gender): Promise<string> {
    return callWithApiKeyRotation(async (client) => {
        const genderContext = gender === 'male' ? 'laki-laki' : gender === 'female' ? 'perempuan' : '';
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Tulis cerita lengkap yang menarik berdasarkan plot berikut: "${storyText}". Genre: ${genre}. ${genderContext ? `Karakter utama adalah ${genderContext}.` : ''} Cerita harus memiliki struktur narasi yang jelas, deskripsi yang jelas, dan akhir yang memuaskan. Tulis dalam bahasa Indonesia yang baik dan benar.`,
        });
        return (response.text || "").trim();
    });
}

export async function generateCharacterProfile(fullStory: string, gender: Gender): Promise<string> {
    return callWithApiKeyRotation(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Berdasarkan cerita berikut, buat deskripsi fisik singkat dan padat (maksimal 2 kalimat) dari karakter utama. Fokus pada detail visual seperti warna rambut, mata, pakaian, dan gaya khas. ${gender !== 'unspecified' ? `Jenis kelamin: ${gender}.` : ''}\n\nCERITA:\n${fullStory}`,
        });
        return (response.text || "").trim();
    });
}

export async function generateStoryScenes(fullStory: string): Promise<{ imagePrompt: string; narration: string }[]> {
    return callWithApiKeyRotation(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analisis cerita berikut dan bagi menjadi 4-6 adegan kunci. Untuk setiap adegan, berikan:
            1. "imagePrompt": Prompt deskriptif bahasa Inggris untuk model AI image generator (gaya Disney Pixar 3D, detail tinggi) yang menggambarkan visual adegan tersebut.
            2. "narration": Teks narasi bahasa Indonesia yang menceritakan bagian cerita tersebut (sekitar 2-3 kalimat).
            
            CERITA:\n${fullStory}
            
            Kembalikan HANYA array JSON objek dengan kunci "imagePrompt" dan "narration".`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            imagePrompt: { type: Type.STRING },
                            narration: { type: Type.STRING }
                        },
                        required: ["imagePrompt", "narration"]
                    }
                }
            }
        });
        const json = JSON.parse(cleanJsonText(response.text || "[]"));
        if (!Array.isArray(json)) throw new Error("Respons AI tidak valid untuk adegan cerita.");
        return json;
    });
}

export async function generateImage(prompt: string, characterInfo: string | CharacterImageData[], aspectRatio: AspectRatio, gender: Gender, promptPrefix: string = ''): Promise<string> {
    return callWithApiKeyRotation(async (client) => {
        let contents: any;
        const genderDesc = gender === 'male' ? 'cute boy' : gender === 'female' ? 'cute girl' : 'cute character';
        
        const basePrompt = `Disney Pixar 3D style animation, ${genderDesc}, ${prompt}. High quality, detailed texture, cinematic lighting, 4k resolution, vibrant colors. ${promptPrefix}`;

        if (Array.isArray(characterInfo)) {
             const parts: any[] = characterInfo.map(img => ({
                inlineData: {
                    mimeType: img.mimeType,
                    data: img.base64.split(',')[1]
                }
            }));
            parts.push({ text: basePrompt + " Make sure the character looks exactly like the reference provided in the image." });
            contents = { parts };
        } else {
            const fullPrompt = characterInfo 
                ? `${basePrompt} Character features: ${characterInfo}.`
                : basePrompt;
            contents = fullPrompt;
        }

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: contents,
            config: {
                responseModalities: [Modality.IMAGE],
            }
        });

        const base64Image = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Image) throw new Error("Gagal menghasilkan gambar.");
        return `data:image/jpeg;base64,${base64Image}`;
    });
}

export async function generateStoryAudio(text: string, voice: Voice): Promise<string> {
    return callWithApiKeyRotation(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: {
                parts: [{ text: text }]
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: voice
                        }
                    }
                }
            }
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("Gagal menghasilkan audio.");
        return base64Audio;
    });
}

export async function extractNarrationFromStory(fullStory: string): Promise<string> {
    return callWithApiKeyRotation(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Ekstrak teks narasi bersih dari cerita berikut untuk diubah menjadi audio. Hapus tanda baca yang tidak perlu untuk dibaca, seperti tanda bintang atau judul bab. Gabungkan menjadi satu paragraf yang mengalir. \n\nCERITA:\n${fullStory}`,
        });
        return (response.text || "").trim();
    });
}

export async function generateAffiliatePackage(
    characterImage: CharacterImageData | null, 
    productImage: CharacterImageData | null, 
    scenario: string,
    language: string = "Indonesian"
): Promise<{ images: (string | null)[], videoJson: any[] }> {
    return callWithApiKeyRotation(async (client) => {
        // 1. Generate Prompt Video (JSON) first
        const videoPromptResponse = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Buat rencana konten video UGC 7 adegan berdasarkan skenario ini: "${scenario}". 
            Fokus: ${characterImage && productImage ? 'Interaksi Karakter dengan Produk' : characterImage ? 'Vlog Karakter/Personal Branding' : 'Showcase Produk Sinematik'}.
            Bahasa Output: ${language}.
            
            Untuk setiap adegan (total 7), berikan objek JSON dengan:
            - "image_prompt": Prompt deskriptif untuk AI gambar (Bahasa Inggris, fotorealistik, gaya TikTok/Reels, aspek rasio 9:16).
            - "spoken_script": Skrip narasi pendek untuk dibacakan (Voice Over) dalam bahasa ${language}. Jangan sertakan teks visual/overlay, hanya kata-kata yang diucapkan. Durasi sekitar 5-8 detik per adegan.
            
            Kembalikan HANYA array JSON valid.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            image_prompt: { type: Type.STRING },
                            spoken_script: { type: Type.STRING }
                        },
                        required: ["image_prompt", "spoken_script"]
                    }
                }
            }
        });
        
        const videoJson = JSON.parse(cleanJsonText(videoPromptResponse.text || "[]"));
        if (!Array.isArray(videoJson) || videoJson.length === 0) throw new Error("Gagal menghasilkan rencana video.");

        // 2. Generate Images based on prompts
        const imagePromises = videoJson.map(async (scene: any) => {
            try {
                const parts: any[] = [];
                if (characterImage) {
                    parts.push({
                        inlineData: {
                            mimeType: characterImage.mimeType,
                            data: characterImage.base64.split(',')[1]
                        }
                    });
                }
                if (productImage) {
                    parts.push({
                        inlineData: {
                            mimeType: productImage.mimeType,
                            data: productImage.base64.split(',')[1]
                        }
                    });
                }

                let promptText = `Photorealistic UGC social media photo, portrait 9:16 aspect ratio. ${scene.image_prompt}. High quality, natural lighting.`;
                
                if (characterImage && productImage) {
                    promptText += " Include the character and product from the reference images seamlessly.";
                } else if (characterImage) {
                     promptText += " Include the character from the reference image.";
                } else if (productImage) {
                     promptText += " Show the product from the reference image clearly.";
                }

                parts.push({ text: promptText });

                const imgResponse = await client.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts },
                    config: { responseModalities: [Modality.IMAGE] }
                });
                 
                const base64 = imgResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                return base64 ? `data:image/jpeg;base64,${base64}` : null;
            } catch (e) {
                console.error("Gagal generate image UGC:", e);
                return null;
            }
        });

        const images = await Promise.all(imagePromises);
        
        return { images, videoJson };
    });
}

// --- Music Lyric Functions ---

async function identifySongFromYoutube(url: string, useSearch: boolean = true): Promise<{ artist: string; title: string; isUnknown?: boolean }> {
    return callWithApiKeyRotation(async (client) => {
        let contents: any = `Identifikasi artis dan judul lagu dari URL YouTube ini: ${url}.`;
        let tools: any[] | undefined = undefined;
        let responseSchema: any | undefined = undefined;
        let responseMimeType: string | undefined = undefined;

        if (useSearch) {
            contents += ` Gunakan Google Search untuk mendapatkan informasi yang akurat. Kembalikan respons JSON mentah dengan format { "artist": "Nama Artis", "title": "Judul Lagu" }. Jika tidak dapat diidentifikasi, kembalikan { "artist": "Unknown", "title": "Unknown" }.`;
            tools = [{ googleSearch: {} }];
        } else {
             // Fallback mode: Guess from URL string or internal knowledge
            contents += ` Tebak sebaik mungkin berdasarkan struktur URL atau pengetahuan internal Anda. Jangan bilang tidak tahu. Jika ragu, tebak saja. Kembalikan JSON.`;
            responseMimeType = "application/json";
            responseSchema = {
                type: Type.OBJECT,
                properties: {
                    artist: { type: Type.STRING },
                    title: { type: Type.STRING }
                },
                required: ["artist", "title"]
            };
        }

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: { tools, responseMimeType, responseSchema }
        });

        const text = cleanJsonText(response.text || "");
        
        // Manual parsing needed for Search Grounding enabled requests
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const json = JSON.parse(jsonMatch[0]);
                if (json.artist === "Unknown" || json.title === "Unknown") {
                    return { artist: "Unknown", title: "Unknown", isUnknown: true };
                }
                return json;
            } catch (e) {
                console.warn("Failed to parse JSON from identification response:", e);
            }
        }
        
        // If simple mode JSON parsing works
        try {
             const json = JSON.parse(text);
             return json;
        } catch (e) {
             return { artist: "Unknown", title: "Unknown", isUnknown: true };
        }
    });
}

async function getLyricsForSong(artist: string, title: string, useSearch: boolean = true): Promise<LyricData> {
    return callWithApiKeyRotation(async (client) => {
        const query = `${title} ${artist} lyrics full text genius musixmatch original language`;
        
        let contents = `Cari dan ambilkan lirik lagu lengkap untuk "${title}" oleh "${artist}".
        
        ATURAN PENTING:
        1. Cari di sumber terpercaya seperti Genius.com, Musixmatch, atau sumber lokal (KapanLagi, Melon, dll) yang sesuai dengan asal lagu.
        2. Ambil lirik dalam BAHASA ASLI (JANGAN diterjemahkan ke Inggris jika lagunya Indonesia/Korea/Jepang/dll).
        3. JANGAN sertakan Chord/Kunci Gitar. Hanya lirik teks.
        4. Format output HARUS menyertakan tag struktur lagu seperti [Verse 1], [Chorus], [Bridge], [Outro] agar siap dipakai di Suno AI.
        5. Tambahkan tag [Style: Genre] di baris paling atas (misal: [Style: Pop Ballad]).
        6. Bersihkan teks dari sampah seperti "Embed", "Share", "URL", "Contributors".
        7. Jika menggunakan Google Search, kembalikan list URL sumber di bagian akhir.
        
        Format Output yang diminta:
        [Lirik Lengkap dengan tag struktur]
        `;

        let tools: any[] | undefined = undefined;
        
        if (useSearch) {
            tools = [{ googleSearch: {} }];
        } else {
            contents += "\n(Gunakan pengetahuan internal Anda karena pencarian sedang tidak tersedia).";
        }

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: { tools }
        });

        const text = (response.text || "").trim();
        
        // Extract sources from grounding metadata if available
        const sources: { title: string; uri: string }[] = [];
        if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            response.candidates[0].groundingMetadata.groundingChunks.forEach((chunk: any) => {
                if (chunk.web?.uri) {
                    sources.push({ title: chunk.web.title || "Source", uri: chunk.web.uri });
                }
            });
        }

        return { lyrics: text, sources };
    });
}

export async function getLyricsFromYoutube(url: string): Promise<LyricData> {
    // 1. Try with Search Grounding (Best Quality)
    try {
        const songInfo = await identifySongFromYoutube(url, true);
        
        if (songInfo.isUnknown) {
             throw new Error("Unknown song"); // Trigger fallback
        }

        return await getLyricsForSong(songInfo.artist, songInfo.title, true);

    } catch (error: any) {
        // NOTE: We intentionally swallow Quota/429 errors here to allow the manual fallback to trigger.
        // This ensures the user sees the "Manual Template" instead of a red error block.
        
        console.warn("Search grounding failed or song unknown, falling back to internal knowledge...", error);
        
        // 2. Fallback: Try without Search (Internal Knowledge)
        try {
            const songInfoFallback = await identifySongFromYoutube(url, false);
            if (songInfoFallback.isUnknown) {
                 // 3. Ultimate Fallback: Return Empty Template
                 return {
                    lyrics: "[Style: Pop]\n[Verse 1]\n(Silakan tempel lirik lagu di sini secara manual...)\n\n[Chorus]\n...",
                    sources: [{ title: "Manual Mode (AI could not identify song)", uri: "#" }]
                 };
            }
            return await getLyricsForSong(songInfoFallback.artist, songInfoFallback.title, false);
        } catch (fallbackError: any) {
             // Ultimate Fallback for ANY error (including quota)
             return {
                lyrics: "[Style: Pop]\n[Verse 1]\n(Silakan tempel lirik lagu di sini secara manual...)\n\n[Chorus]\n...",
                sources: [{ title: "Manual Mode (System Error)", uri: "#" }]
             };
        }
    }
}

export async function translateLyrics(originalLyrics: string, targetLanguage: string): Promise<LyricLine[]> {
    return callWithApiKeyRotation(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Terjemahkan lirik lagu berikut ke dalam bahasa ${targetLanguage}.
            PENTING:
            1. Pertahankan jumlah baris yang sama persis.
            2. Lakukan sinkronisasi baris demi baris.
            3. Jangan terjemahkan tag struktur seperti [Verse], [Chorus], [Style]. Biarkan apa adanya.
            4. Output HARUS berupa array JSON objek: { "original": "Baris Asli", "translated": "Baris Terjemahan" }.
            
            LIRIK ASLI:
            ${originalLyrics}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            original: { type: Type.STRING },
                            translated: { type: Type.STRING }
                        },
                        required: ["original", "translated"]
                    }
                }
            }
        });
        
        const json = JSON.parse(cleanJsonText(response.text || "[]"));
        return json;
    });
}

// --- Video Generation Functions (Veo) ---

export async function generateVeoVideo(prompt: string, aspectRatio: AspectRatio, model: VeoModel, resolution: VideoResolution, image?: CharacterImageData | null): Promise<string> {
    return callWithApiKeyRotation(async (client, currentKey) => {
        console.log(`Memulai pembuatan video dengan model ${model}, resolusi ${resolution}...`);
        
        const params: any = {
            model: model,
            prompt: prompt, // Optional if image is present but recommended
            config: {
                numberOfVideos: 1,
                resolution: resolution, // Use selected resolution
                aspectRatio: aspectRatio
            }
        };

        // Add image input if provided (Image-to-Video)
        if (image) {
            params.image = {
                imageBytes: image.base64.split(',')[1],
                mimeType: image.mimeType
            };
            console.log("Menyertakan gambar input untuk Image-to-Video...");
        }

        // Step 1: Initiate video generation operation
        let operation;
        try {
            operation = await client.models.generateVideos(params);
        } catch (e: any) {
             const errString = JSON.stringify(e);
             // Handle 404 specifically for invalid models or access issues
             if (errString.includes("NOT_FOUND") || e.status === 404 || e.code === 404) {
                 const isVeo2 = model.includes('veo-2.0');
                 const suggestion = isVeo2 ? "Veo 3.1" : "Veo 3.1 Fast";
                 throw new Error(`Model video '${model}' tidak tersedia atau tidak ditemukan. Google mungkin telah menonaktifkan model ini atau kunci API Anda belum memiliki akses. Silakan coba ganti ke model '${suggestion}' di pengaturan.`);
             }
             throw e;
        }

        // Step 2: Poll until operation is done
        // We need to access operations from the client instance
        const operationsClient = client.operations;
        
        const startTime = Date.now();
        const timeout = 300000; // 5 mins timeout safety

        while (!operation.done) {
            if (Date.now() - startTime > timeout) {
                 throw new Error("Video generation timed out (5 minutes).");
            }
            
            console.log("Menunggu video selesai diproses (Polling 10s)...");
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s to allow propagation

            try {
                // IMPORTANT: use 'operation' property as per system instruction
                const updatedOp = await operationsClient.getVideosOperation({ operation: operation });
                if (updatedOp) {
                    operation = updatedOp;
                }
            } catch (err: any) {
                 // AGGRESSIVE 404 CHECK:
                 // Google Video operations often return 404 immediately after creation due to propagation delay.
                 // We MUST swallow this error and retry, otherwise the app crashes.
                 const errString = JSON.stringify(err);
                 const is404 = 
                    (err.status === 404) || 
                    (err.code === 404) ||
                    (err.message && err.message.includes("404")) || 
                    (err.message && err.message.toLowerCase().includes("not found")) ||
                    (errString.includes("NOT_FOUND"));

                if (is404) {
                    console.warn("Operation entity not found yet (404), retrying in next poll...");
                    // Continue loop, don't crash. Just wait for next cycle.
                    continue;
                }
                // Rethrow other errors (e.g., auth, quota)
                throw err;
            }
        }

        // Step 3: Get Download Link
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        
        if (!downloadLink) {
             throw new Error("Video berhasil dibuat tetapi tautan unduhan tidak ditemukan.");
        }

        // Step 4: Fetch the video binary using the key (proxy via browser)
        // Important: Use the SAME key that initiated the request
        const response = await fetch(`${downloadLink}&key=${currentKey}`);
        
        if (!response.ok) {
            throw new Error(`Gagal mengunduh video final: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    });
}
