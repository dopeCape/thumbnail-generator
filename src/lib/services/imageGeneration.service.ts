import Logger from "./logger.service";
import LLMService from "./llm.service";
import { put } from '@vercel/blob';
import { v4 } from "uuid";
import { FetchMessages } from "@/types";

export default class ImageGenerationService {
  #logger = Logger
  #llmService = new LLMService()

  async generateImage(messages: FetchMessages) {
    const response = await this.fetchGenerateImage(messages);
    const base64ImageData = response.choices[0].message.images[0].image_url.url;

    const imageBuffer = this.#decodeBase64Image(base64ImageData);

    const url = await this.#uploadImage(`${v4()}.png`, imageBuffer);
    return url;
  }

  #decodeBase64Image(base64Data: string): Buffer {
    const base64String = base64Data.includes(',')
      ? base64Data.split(',')[1]
      : base64Data;

    return Buffer.from(base64String, 'base64');
  }

  async #uploadImage(imageName: string, imageData: Buffer) {
    const blob = await put(imageName, imageData, {
      access: 'public',
      allowOverwrite: true,
      contentType: "image/png"
    });
    return blob.url;
  }


  async fetchGenerateImage(message: FetchMessages): Promise<{ choices: [{ message: { images: [{ image_url: { url: string } }] } }] }> {
    const data = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "google/gemini-2.5-flash-image-preview:free",
        "messages": message
      })
    });
    return await data.json();
  }
}
