import { GoogleGenAI, Type } from "@google/genai";

export interface TranslationBox {
  originalText: string;
  translatedText: string;
  boundingBox: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  };
  backgroundColor: string;
  textColor: string;
  fontSize: number;
}

export async function translateManhwaPage(
  base64Image: string,
  targetLanguage: string = "Portuguese"
): Promise<TranslationBox[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `Analyze this manhwa/manga page. 
  1. Detect all text bubbles and captions.
  2. For each one, extract the original text and translate it into ${targetLanguage}.
  3. Provide the bounding box coordinates for each text area (normalized 0-1000).
  4. Identify the dominant background color of the bubble (hex) and the text color (hex).
  5. Estimate a suitable font size relative to the box height.
  
  Return the data as a JSON array of objects.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(",")[1] || base64Image,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalText: { type: Type.STRING },
              translatedText: { type: Type.STRING },
              boundingBox: {
                type: Type.OBJECT,
                properties: {
                  ymin: { type: Type.NUMBER },
                  xmin: { type: Type.NUMBER },
                  ymax: { type: Type.NUMBER },
                  xmax: { type: Type.NUMBER },
                },
                required: ["ymin", "xmin", "ymax", "xmax"],
              },
              backgroundColor: { type: Type.STRING },
              textColor: { type: Type.STRING },
              fontSize: { type: Type.NUMBER },
            },
            required: ["originalText", "translatedText", "boundingBox", "backgroundColor", "textColor"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
}
