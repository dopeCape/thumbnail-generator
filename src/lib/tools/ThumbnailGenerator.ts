import { tool } from "ai";
import PromptProvider from "@/lib/providers/prompt.provider";
import LLMService from "@/lib/services/llm.service";
import ThumbnailVectorizer from "../services/thumbnail.service";
import Logger from "@/lib/services/logger.service";
import z from "zod";
import type { AvaliableModels, AvaliableProvides } from "@/types";
import createMessage from "../utils/message";
import ImageGenerationService from "../services/imageGeneration.service";
import createImageGenerationMessage from "../utils/imageGenerationMessage";

const ThumbnailGenerator = tool({
  name: 'thumbnail-generator-tool',
  description: 'Generate a thumbnail using reference thumbnails from successful creators as inspiration',
  inputSchema: z.object({
    userRequest: z.string().describe("requirement and details that user provided, provide the request as it is from the user, do not add instructions yourself, exact the request from the user, word by word"),
    attachedImagesUrl: z.array(z.string().describe("URL of the images that user provided/attached")),
  }),
  execute: async ({ userRequest, attachedImagesUrl }) => {
    const startTime = Date.now();
    const sessionId = `thumb_${Date.now()}_${Math.random().toString(36)}`;

    Logger.log(`[${sessionId}] 🚀 Starting thumbnail generation process`);
    Logger.log(`[${sessionId}] 📝 User request: "${userRequest}"`);
    Logger.log(`[${sessionId}] 🖼️ Attached images count: ${attachedImagesUrl.length}`);

    if (attachedImagesUrl.length > 0) {
      Logger.log(`[${sessionId}] 📎 Attached image URLs: ${attachedImagesUrl.join(', ')}`);
    }

    try {
      const ls = new LLMService();
      const imageGenerationService = new ImageGenerationService();
      const thumbnailVectorizer = new ThumbnailVectorizer();

      Logger.log(`[${sessionId}] 🔍 Searching for similar thumbnails in vector database...`);
      const vectorSearchStart = Date.now();

      const similarThumbnails = await thumbnailVectorizer.findSimilarThumbnails(
        userRequest,
        5,
      );

      const vectorSearchTime = Date.now() - vectorSearchStart;
      Logger.log(`[${sessionId}] ✅ Vector search completed in ${vectorSearchTime}ms`);
      Logger.log(`[${sessionId}] 📊 Found ${similarThumbnails.length} similar thumbnails`);

      if (similarThumbnails.length === 0) {
        Logger.warn(`[${sessionId}] ⚠️ No similar thumbnails found in vector database`);
      } else {
        similarThumbnails.forEach((ref, index) => {
          Logger.log(`[${sessionId}] 📋 Reference ${index + 1}: Score: ${ref.score?.toFixed(3)}, Channel: ${ref.metadata?.channel_name}, ID: ${ref.id}, url: ${ref.metadata?.url}`);
          Logger.log(`[${sessionId}] 🎯 Reference ${index + 1} description: ${ref.metadata?.semantic_description}...`);
        });
      }

      Logger.log(`[${sessionId}] 🔧 Formatting references for LLM input...`);

      const referencesText = similarThumbnails
        .map(ref => `${ref?.metadata?.url} - ${ref.metadata?.semantic_description} - ${ref.id}`)
        .join('\n');

      Logger.log(`[${sessionId}] 📝 References text length: ${referencesText.length} characters`);

      const systemPrompt = PromptProvider.getImageDirectionPrompt();
      const userPrompt = `${userRequest}\n\nReferences:\n${referencesText}`;

      Logger.log(`[${sessionId}] 📋 System prompt length: ${systemPrompt.length} characters`);
      Logger.log(`[${sessionId}] 📋 User prompt length: ${userPrompt.length} characters`);

      // Step 3: Prepare ALL reference URLs for LLM analysis (but not for image generation yet)
      const referenceUrls = similarThumbnails
        .map(ref => ref.metadata?.url)
        .filter(url => url);

      Logger.log(`[${sessionId}] 🖼️ Valid reference image URLs for analysis: ${referenceUrls.length}`);

      const allImageUrlsForAnalysis = [...attachedImagesUrl, ...referenceUrls];
      Logger.log(`[${sessionId}] 🖼️ Total images for LLM analysis: ${allImageUrlsForAnalysis.length} (${attachedImagesUrl.length} user + ${referenceUrls.length} references)`);

      // Step 4: Generate direction via LLM with reference selection
      const provider: AvaliableProvides = "openai";
      const model: AvaliableModels = "gpt-5-mini";

      Logger.log(`[${sessionId}] 🤖 Calling LLM for direction generation and reference selection - Provider: ${provider}, Model: ${model}`);

      // Updated schema to include selected reference URL (singular)
      const schema = z.object({
        imageDirection: z.string().describe("Detailed image generation direction"),
        bestUseCase: z.string().describe("Best Use Case for this thumbnail"),
        selectedReferenceUrl: z.string().describe("URL of the single best reference thumbnail selected for image generation (from the provided references)"),
        selectionReasoning: z.string().describe("Why this specific reference was chosen as most suitable for this request")
      });

      const messages = createMessage(systemPrompt, userPrompt, allImageUrlsForAnalysis as any);
      const llmStart = Date.now();

      const response = await ls.structedResponse(messages, schema, { provider, model });

      const llmTime = Date.now() - llmStart;
      Logger.log(`[${sessionId}] ✅ LLM direction generation completed in ${llmTime}ms`);
      Logger.log(`[${sessionId}] 🎯 Generated direction length: ${response.imageDirection.length} characters`);
      Logger.log(`[${sessionId}] 💡 Best use case: ${response.bestUseCase}`);
      Logger.log(`[${sessionId}] 🔍 Selected reference for image generation: ${response.selectedReferenceUrl}`);
      Logger.log(`[${sessionId}] 📝 Selection reasoning: ${response.selectionReasoning}`);
      Logger.log(`[${sessionId}] 📝 Image direction preview: ${response.imageDirection.substring(0, 200)}...`);

      // Step 5: Generate thumbnail image using ONLY the selected reference
      Logger.log(`[${sessionId}] 🎨 Starting image generation with selected reference...`);

      // Use only user images + the single selected reference for image generation
      const finalImageUrls = [...attachedImagesUrl, response.selectedReferenceUrl];

      Logger.log(`[${sessionId}] 🖼️ Final image URLs for generation: ${finalImageUrls.length} (${attachedImagesUrl.length} user + 1 selected reference)`);

      const messageForImageGeneration = createImageGenerationMessage(
        "Based on attached user assets and the specifically selected reference thumbnail, generate a thumbnail",
        response.imageDirection,
        finalImageUrls as any
      );

      Logger.log(`[${sessionId}] 📤 Image generation message prepared with ${finalImageUrls.length} images`);

      const imageGenStart = Date.now();
      const url = await imageGenerationService.generateImage(messageForImageGeneration);
      const imageGenTime = Date.now() - imageGenStart;

      Logger.log(`[${sessionId}] ✅ Image generation completed in ${imageGenTime}ms`);
      Logger.log(`[${sessionId}] 🖼️ Generated image URL: ${url}`);

      // Final success logging
      const totalTime = Date.now() - startTime;
      Logger.log(`[${sessionId}] 🎉 Thumbnail generation completed successfully!`);
      Logger.log(`[${sessionId}] ⏱️ Total process time: ${totalTime}ms (Vector: ${vectorSearchTime}ms, LLM: ${llmTime}ms, Image: ${imageGenTime}ms)`);
      Logger.log(`[${sessionId}] 📊 Performance breakdown: Vector ${((vectorSearchTime / totalTime) * 100).toFixed(1)}%, LLM ${((llmTime / totalTime) * 100).toFixed(1)}%, Image ${((imageGenTime / totalTime) * 100).toFixed(1)}%`);

      return {
        imageUrl: url,
        selectedReference: response.selectedReferenceUrl,
        selectionReasoning: response.selectionReasoning
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      Logger.error(`[${sessionId}] ❌ Thumbnail generation failed after ${totalTime}ms`, error);
      Logger.error(`[${sessionId}] 🔍 Error details:`, {
        userRequest,
        attachedImagesCount: attachedImagesUrl.length,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : 'No stack trace'
      });

      throw new Error(`Thumbnail generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
})

export default ThumbnailGenerator;
