import { GoogleGenAI, Type, Modality } from '@google/genai';
import { AspectRatio, CharacterImageData, Gender, GeneratedImage } from '../types';

let ai: GoogleGenAI | null = null;

/**
 * Retries an async function a specified number of times with exponential backoff.
 * This makes API calls more resilient to transient network errors or API hiccups.
 */
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    let lastError: Error | undefined;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            if (i < retries - 1) {
                console.warn(`Attempt ${i + 1} failed. Retrying in ${delay * (i + 1)}ms...`, error);
                await new Promise(res => setTimeout(res, delay * (i + 1))); // exponential backoff
            }
        }
    }
    console.error(`All ${retries} attempts failed.`);
    throw lastError;
}


export function initializeAiClient(apiKey: string) {
    if (!apiKey) {
        throw new Error("API Key is required to initialize the AI client.");
    }
    ai = new GoogleGenAI({ apiKey });
}

function getAiClient(): GoogleGenAI {
    if (!ai) {
        throw new Error("Gemini AI client not initialized. Please set your API key in settings.");
    }
    return ai;
}


/**
 * Generates a list of initial story ideas.
 */
export async function getInitialIdeas(genre: string, count: number): Promise<string[]> {
  return retry(async () => {
    const client = getAiClient();
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
              }
          }
      }
    });
    const json = JSON.parse(response.text);
    if (!json.ideas) throw new Error("Struktur JSON tidak valid yang diterima dari AI untuk ide awal.");
    return json.ideas;
  });
}

/**
 * Generates a single new idea, ensuring it's different from existing ones.
 */
export async function getNewIdea(genre: string, existingIdeas: string[]): Promise<string> {
    return retry(async () => {
        const client = getAiClient();
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Buat ide cerita baru yang unik, satu kalimat untuk video bergenre ${genre}. Ide ini harus berbeda dari ide-ide yang sudah ada: ${JSON.stringify(existingIdeas)}. Berikan HANYA teks ide baru, tanpa awalan atau format tambahan.`,
        });
        return response.text.trim();
    });
}

/**
 * Generates a new set of ideas based on the current story text.
 */
export async function getNewIdeasFromText(genre: string, storyText: string, count: number): Promise<string[]> {
    return retry(async () => {
        const client = getAiClient();
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Berdasarkan plot cerita yang sedang berkembang ini dalam genre ${genre}:\n\n---\n${storyText}\n---\n\nBuat daftar ${count} ide tindak lanjut yang menarik, masing-masing dalam satu kalimat. Ide-ide ini harus melanjutkan cerita secara logis. Kembalikan HANYA objek JSON yang valid yang berisi daftar ide dalam kunci "ideas".`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        ideas: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        const json = JSON.parse(response.text);
        if (!json.ideas) throw new Error("Struktur JSON tidak valid yang diterima dari AI untuk ide dinamis.");
        return json.ideas;
    });
}


/**
 * Polishes the user's story text.
 */
export async function polishStory(storyText: string, genre: string): Promise<string> {
    return retry(async () => {
        const client = getAiClient();
        const response = await client.models.generateContent({
            model: 'gemini-2.5-pro', // Using a more powerful model for better writing
            contents: `Anda adalah seorang editor ahli. Poles draf cerita berikut dalam genre ${genre}, tingkatkan alur, pilihan kata, dan dampak emosionalnya. Pertahankan ide inti dan poin plot. Jangan menambahkan bagian baru atau mengubah cerita secara drastis. Kembalikan HANYA teks yang sudah dipoles, tanpa komentar tambahan.\n\nDraf:\n---\n${storyText}`,
        });
        return response.text.trim();
    });
}


/**
 * Generates the full story from the provided plot points.
 */
export async function generateFullStory(storyPlot: string, genre: string, gender: Gender): Promise<string> {
    return retry(async () => {
        const client = getAiClient();
        const genderPrompt = gender !== 'unspecified' ? `Protagonisnya adalah ${gender === 'male' ? 'laki-laki' : 'perempuan'}.` : '';
        const response = await client.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: `Tulis cerita pendek yang lengkap dan menarik berdasarkan poin-poin plot berikut dalam genre ${genre}. ${genderPrompt} Cerita harus memiliki awal, tengah, dan akhir yang jelas. Fokus pada pengembangan karakter dan penceritaan deskriptif. Tulis narasi dalam bentuk lampau. Kembalikan HANYA teks cerita lengkap. \n\nPlot:\n---\n${storyPlot}`,
        });
        return response.text.trim();
    });
}

/**
 * Generates a character profile based on the story.
 */
export async function generateCharacterProfile(story: string, gender: Gender): Promise<string> {
    return retry(async () => {
        const client = getAiClient();
        const genderPrompt = gender !== 'unspecified' ? `Karakter ini adalah ${gender === 'male' ? 'laki-laki' : 'perempuan'}.` : '';
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Berdasarkan cerita ini, buat deskripsi karakter visual yang ringkas (satu kalimat) untuk protagonis. Fokus pada fitur yang paling khas. ${genderPrompt}\n\nCerita: ${story}`,
        });
        return response.text.trim();
    });
}

/**
 * Generates a list of image prompts from the story.
 */
export async function generateImagePrompts(story: string): Promise<string[]> {
    return retry(async () => {
        const client = getAiClient();
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Bagi cerita berikut menjadi 6-8 adegan visual utama. Untuk setiap adegan, tulis prompt gambar yang ringkas dan deskriptif yang menangkap momen kunci. Prompt harus cocok untuk model teks-ke-gambar gaya sinematik. Kembalikan HANYA objek JSON yang valid dengan kunci "prompts" yang berisi daftar string prompt.\n\nCerita:\n---\n${story}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        prompts: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        const json = JSON.parse(response.text);
        if (!json.prompts) throw new Error("Struktur JSON tidak valid yang diterima untuk prompt gambar.");
        return json.prompts;
    });
}


function base64ToPart(imageData: CharacterImageData) {
    return {
        inlineData: {
            data: imageData.base64.split(',')[1],
            mimeType: imageData.mimeType,
        },
    };
}


/**
 * Generates a single image based on a prompt and character info.
 */
export async function generateImage(prompt: string, characterInfo: string | CharacterImageData | CharacterImageData[], aspectRatio: AspectRatio, gender: Gender): Promise<string> {
   return retry(async () => {
        const client = getAiClient();
        const genderText = gender === 'unspecified' ? '' : `, ${gender}`;

        // Handle text-only case: character info is a non-empty string description
        if (typeof characterInfo === 'string' && characterInfo.trim()) {
            const fullPrompt = `Gaya: Gaya seni animasi 3D sinematik, seperti film Pixar.
Karakter Utama: ${characterInfo}${genderText}.
Adegan: ${prompt}.
Pastikan karakter utama konsisten di semua gambar.`;

            const response = await client.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: fullPrompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/png',
                    aspectRatio: aspectRatio,
                },
            });

            const generatedImage = response.generatedImages?.[0];
            if (generatedImage && generatedImage.image.imageBytes) {
                return `data:image/png;base64,${generatedImage.image.imageBytes}`;
            }
            throw new Error('Gagal membuat gambar berbasis teks. Respons AI tidak berisi data gambar.');
        }
        
        // Handle multimodal case: character info is a valid image object or array of image objects
        if (typeof characterInfo === 'object' && characterInfo !== null) {
            const imageInfos = Array.isArray(characterInfo) ? characterInfo : [characterInfo];
            
            if (imageInfos.length > 0 && imageInfos[0]?.base64) {
                const imageParts = imageInfos.map(info => base64ToPart(info));
                
                let textPartText = `Cocokkan karakter dari gambar. Letakkan karakter dalam adegan ini: ${prompt}. PENTING: Gambar yang dihasilkan HARUS memiliki rasio aspek ${aspectRatio} murni tanpa pemotongan (cropping) atau letterboxing.`;
                if (imageInfos.length > 1) { // Affiliate mode specific prompt
                    textPartText = `Gunakan gambar referensi ini (gambar pertama adalah karakter, gambar kedua adalah produk) untuk konteks. Buat gambar baru berdasarkan prompt ini: ${prompt}. Jaga konsistensi karakter dan produk. PENTING: Gambar yang dihasilkan HARUS memiliki rasio aspek 9:16 (potret) murni tanpa pemotongan (cropping) atau letterboxing.`
                }
                
                const textPart = { text: textPartText };

                const response = await client.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: [...imageParts, textPart] },
                    config: {
                        responseModalities: [Modality.IMAGE],
                    },
                });

                const imageResponsePart = response.candidates?.[0]?.content?.parts?.[0];
                if (imageResponsePart && imageResponsePart.inlineData) {
                    return `data:${imageResponsePart.inlineData.mimeType};base64,${imageResponsePart.inlineData.data}`;
                }
                throw new Error('Gagal membuat gambar dari gambar yang diunggah. Respons AI tidak berisi data gambar.');
            }
        }

        // If neither of the above conditions are met, the input is invalid.
        throw new Error('Informasi karakter tidak valid untuk pembuatan gambar. Diperlukan deskripsi teks atau gambar yang valid.');
   });
}

/**
 * Generates a UGC-style scenario from character and product images.
 */
export async function generateAffiliateScenario(characterImage: CharacterImageData, productImage: CharacterImageData): Promise<string> {
    return retry(async () => {
        const client = getAiClient();
        const imageParts = [base64ToPart(characterImage), base64ToPart(productImage)];
        const textPart = {
            text: `Berdasarkan gambar orang (gambar pertama) dan produk (gambar kedua), buatlah satu skenario video pendek yang menarik bergaya UGC (User-Generated Content). Skenario harus ringkas, sekitar 2-3 kalimat. Kembalikan HANYA teks skenario, tanpa penjelasan atau format tambahan.`,
        };

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [...imageParts, textPart] },
        });
        return response.text.trim();
    });
}


/**
 * Generates a package of affiliate marketing content.
 */
export async function generateAffiliatePackage(characterImage: CharacterImageData, productImage: CharacterImageData, language: string): Promise<{ images: string[], videoJson: object[] }> {
    return retry(async () => {
        const client = getAiClient();
        
        // Step 1: Generate the plan (image prompts and video JSON)
        const imageParts = [base64ToPart(characterImage), base64ToPart(productImage)];
        const textPart = {
            text: `Anda adalah seorang sutradara virtual dan ahli konten UGC (User-Generated Content). Tugas Anda adalah membuat paket konten yang kohesif untuk video promosi pendek.

Berdasarkan aset berikut:
- Gambar Karakter (gambar pertama)
- Gambar Produk (gambar kedua)

Buat paket konten yang saling berhubungan. Anda HARUS mengembalikan objek JSON yang valid dengan dua kunci: "image_prompts" dan "video_scripts". Semua teks yang dihasilkan (prompt, deskripsi, skrip) HARUS dalam bahasa ${language}.

1.  **"image_prompts"**: Ini harus berupa sebuah array berisi **TEPAT 7 string prompt gambar**. Ketujuh prompt ini harus mendeskripsikan urutan visual dari sebuah video UGC klasik dan secara alami menghasilkan gambar vertikal yang pas dalam rasio aspek 9:16:
    *   Prompt 1 (Hook): Shot yang menarik perhatian, menampilkan karakter dengan ekspresi penasaran atau bersemangat terhadap produk.
    *   Prompt 2 (Unboxing/Reveal): Karakter membuka atau memperlihatkan produk untuk pertama kalinya.
    *   Prompt 3 (Product in Context): Shot medium yang menunjukkan karakter mulai menggunakan produk dalam lingkungan yang relevan.
    *   Prompt 4 (Close-up Feature 1): Shot close-up yang detail pada salah satu fitur utama produk.
    *   Prompt 5 (Benefit Shot): Shot yang menunjukkan hasil atau manfaat positif dari penggunaan produk (misalnya, karakter tersenyum puas).
    *   Prompt 6 (Lifestyle): Shot yang lebih luas yang mengintegrasikan produk ke dalam gaya hidup karakter.
    *   Prompt 7 (Call to Action): Shot akhir karakter memegang produk, menunjuk ke arah teks overlay, atau memberikan acungan jempol.
    Pastikan karakter dan produk konsisten di semua prompt.

2.  **"video_scripts"**: Ini harus berupa sebuah array berisi **TEPAT 7 objek JSON**. Setiap objek harus sesuai dengan prompt gambar pada indeks yang sama dan mendeskripsikan klip video pendek (sekitar 8 detik) yang saling menyambung. Setiap objek hanya akan berisi deskripsi adegan dan skrip sulih suara (voiceover_script). Skrip sulih suara harus pendek, jelas, dan mudah diucapkan, dan ini akan menjadi satu-satunya audio, menghasilkan video yang bersih. Jangan sertakan instruksi untuk musik latar, efek suara, atau teks overlay. Semua nilai teks dalam objek ini HARUS dalam bahasa ${language}.`
        };

        const planResponse = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [...imageParts, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        image_prompts: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        video_scripts: {
                           type: Type.ARRAY,
                           items: {
                                type: Type.OBJECT,
                                properties: {
                                    scene_description: {
                                        type: Type.STRING,
                                        description: "Deskripsi visual adegan."
                                    },
                                    voiceover_script: {
                                        type: Type.STRING,
                                        description: "Skrip sulih suara yang pendek dan jelas untuk dibacakan, cocok untuk klip 8 detik. Maksimal 2 kalimat. Ini adalah satu-satunya audio."
                                    }
                                },
                                required: ["scene_description", "voiceover_script"],
                           }
                        }
                    },
                    required: ["image_prompts", "video_scripts"]
                }
            }
        });

        const plan = JSON.parse(planResponse.text);
        if (!plan.image_prompts || !plan.video_scripts || plan.image_prompts.length !== 7 || plan.video_scripts.length !== 7) {
            throw new Error("Gagal menghasilkan rencana konten yang valid (7 gambar dan 7 skrip) dari AI.");
        }

        const imagePrompts: string[] = plan.image_prompts;
        
        // Step 2: Generate the 7 images based on the new prompts, using the original images as reference.
        const imagePromises = imagePrompts.map(prompt => 
            generateImage(prompt, [characterImage, productImage], '9:16', 'unspecified')
        );

        const images = await Promise.all(imagePromises);

        return { images, videoJson: plan.video_scripts };
    });
}


/**
 * Extracts just the narration from a story for TTS.
 */
export async function extractNarrationFromStory(story: string): Promise<string> {
    return retry(async () => {
        const client = getAiClient();
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Ekstrak dan gabungkan semua bagian narasi dari cerita berikut menjadi satu paragraf yang mengalir. Hapus semua dialog. Tujuannya adalah untuk membuat skrip narator untuk video. Kembalikan HANYA teks narasi.\n\nCerita:\n---\n${story}`
        });
        return response.text.trim();
    });
}

/**
 * Generates audio narration for a story.
 */
export async function generateStoryAudio(narration: string, voice: string): Promise<string> {
    return retry(async () => {
        const client = getAiClient();
        const response = await client.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: narration }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
                    },
                },
            },
        });
        const audioPart = response.candidates?.[0]?.content?.parts?.[0];
        if (audioPart && audioPart.inlineData) {
            return audioPart.inlineData.data;
        }
        throw new Error("Gagal membuat audio. Respons tidak berisi data audio.");
    });
}


/**
 * Generates the full video from story and images.
 */
export async function generateVideoFromStory(story: string, images: GeneratedImage[], aspectRatio: AspectRatio): Promise<string | undefined> {
    return retry(async () => {
        const client = getAiClient(); // Re-initialize for video key
        const validImages = images.filter(img => img.src).map(img => ({
            image: {
                imageBytes: img.src!.split(',')[1],
                mimeType: 'image/png'
            }
        }));

        if (validImages.length === 0) throw new Error("Tidak ada gambar yang valid untuk membuat video.");

        let operation = await client.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: `Buat video pendek sinematik berdasarkan cerita ini: ${story}. Gunakan gambar yang disediakan sebagai referensi visual utama untuk adegan.`,
            image: validImages[0].image,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: aspectRatio,
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await client.operations.getVideosOperation({ operation: operation });
        }

        return operation.response?.generatedVideos?.[0]?.video?.uri;
    });
}

/**
 * Splits the story into narrations for each scene/image.
 */
export async function splitStoryIntoSceneNarrations(story: string, imagePrompts: string[]): Promise<string[]> {
    return retry(async () => {
        const client = getAiClient();
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Cocokkan cerita berikut dengan daftar prompt gambar adegan ini. Untuk setiap prompt, ekstrak bagian narasi yang sesuai dari cerita. Setiap narasi harus pendek dan hanya mendeskripsikan apa yang terjadi dalam adegan itu. Kembalikan HANYA objek JSON yang valid dengan kunci "narrations" yang berisi daftar string narasi yang sama urutannya dengan prompt.\n\nCerita:\n---\n${story}\n\nPrompts:\n---\n${JSON.stringify(imagePrompts)}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        narrations: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        const json = JSON.parse(response.text);
        if (!json.narrations || json.narrations.length !== imagePrompts.length) {
            throw new Error("Gagal menyelaraskan narasi dengan adegan.");
        }
        return json.narrations;
    });
}

/**
 * Generates a video for a single scene (image + narration).
 */
export async function generateVideoForScene(narration: string, image: GeneratedImage, aspectRatio: AspectRatio): Promise<string | undefined> {
     return retry(async () => {
        const client = getAiClient();
        if (!image.src) throw new Error("Gambar sumber tidak valid.");

        let operation = await client.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: `Buat klip video pendek dan dinamis berdasarkan deskripsi ini: ${narration}.`,
            image: {
                imageBytes: image.src.split(',')[1],
                mimeType: 'image/png'
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: aspectRatio,
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await client.operations.getVideosOperation({ operation: operation });
        }

        return operation.response?.generatedVideos?.[0]?.video?.uri;
    });
}
