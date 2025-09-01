import Logger from "./logger.service";
import { put } from '@vercel/blob';
import { v4 } from "uuid";
import { FetchMessages } from "@/types";
import RetryHandler from "../utils/retry";

export default class ImageGenerationService {
  #logger = Logger;

  async generateImage(messages: FetchMessages): Promise<string> {
    const sessionId = `img_gen_${Date.now()}`;
    this.#logger.log(`[${sessionId}] Starting image generation process`);

    try {
      this.#logger.log(`[${sessionId}] Generating image via API...`);
      const response = await RetryHandler.withRetry(
        () => this.fetchGenerateImage(messages),
        2,
        2000,
        `[${sessionId}] Image Generation API`
      );

      this.#logger.log(`[${sessionId}] Decoding base64 image data...`);
      const base64ImageData = response.choices[0].message.images[0].image_url.url;
      const imageBuffer = await RetryHandler.withRetry(
        () => Promise.resolve(this.#decodeBase64Image(base64ImageData)),
        1,
        500,
        `[${sessionId}] Base64 Decoding`
      );

      this.#logger.log(`[${sessionId}] Uploading image to blob storage...`);
      const imageName = `${v4()}.png`;
      const url = await RetryHandler.withRetry(
        () => this.#uploadImage(imageName, imageBuffer),
        2,
        1500,
        `[${sessionId}] Image Upload`
      );

      this.#logger.log(`[${sessionId}] Image generation completed successfully: ${url}`);
      return url;

    } catch (error) {
      this.#logger.error(`[${sessionId}] Image generation failed completely`, error);
      throw new Error(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  #decodeBase64Image(base64Data: string): Buffer {
    try {
      const base64String = base64Data.includes(',')
        ? base64Data.split(',')[1]
        : base64Data;

      if (!base64String) {
        throw new Error('Invalid base64 data: empty string');
      }

      return Buffer.from(base64String, 'base64');
    } catch (error) {
      this.#logger.error('Base64 decoding failed', { base64Data: base64Data.substring(0, 100) + '...' });
      throw new Error(`Base64 decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async #uploadImage(imageName: string, imageData: Buffer): Promise<string> {
    try {
      if (!imageData || imageData.length === 0) {
        throw new Error('Image data is empty or invalid');
      }

      const blob = await put(imageName, imageData, {
        access: 'public',
        allowOverwrite: true,
        contentType: "image/png"
      });

      if (!blob.url) {
        throw new Error('Upload succeeded but no URL returned');
      }

      return blob.url;
    } catch (error) {
      this.#logger.error('Image upload failed', {
        imageName,
        imageSize: imageData?.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async fetchGenerateImage(message: FetchMessages): Promise<{ choices: [{ message: { images: [{ image_url: { url: string } }] } }] }> {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": "google/gemini-2.5-flash-image-preview:free",
          "messages": message
        }),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to read error response');
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices?.[0]?.message?.images?.[0]?.image_url?.url) {
        throw new Error('Invalid API response structure: missing image URL');
      }

      return data;
    } catch (error) {
      if ((error as any).name === 'TimeoutError') {
        throw new Error('Image generation request timed out');
      }
      throw error;
    }
  }
}
