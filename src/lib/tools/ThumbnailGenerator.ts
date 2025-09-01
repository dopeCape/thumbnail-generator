import { tool } from "ai";

import PromptProvider from "@/lib/providers/prompt.provider";
import LLMService from "@/lib/services/llm.service";
import z from "zod";
import type { AvaliableModels, AvaliableProvides } from "@/types";
import createMessage from "../utils/message";
import ImageGenerationService from "../services/imageGeneration.service";
import createImageGenerationMessage from "../utils/imageGenerationMessage";

const ThumbnailGenerator = tool({
  name: 'thumbnail-generator-tool',
  description: 'you can you thi tool to generate a thumbnail from scratch, dont not add any text from your side ',
  inputSchema: z.object({
    userRequest: z.string().describe("requirement and details that user provided, provide the request as it is from the user, do not add instructions yourself, exact the request from the user, word by word"),
    attachedImagesUrl: z.array(z.string().describe("URL of the images that userd provided/attached")),
  }),
  execute: async ({ userRequest, attachedImagesUrl }) => {
    const ls = new LLMService()
    const imageGenerationService = new ImageGenerationService()
    const systemPrompt = PromptProvider.getImageDirectionPrompt();
    const schema = z.object({
      directions: z.array(
        z.object({
          imageDirection: z.string().describe("Image Direction"),
          bestUseCase: z.string().describe("Best Use Case for this thumbnail"),
        })
      ),
    })
    const provider: AvaliableProvides = "openai";
    const model: AvaliableModels = "gpt-5-mini";
    const messages = createMessage(systemPrompt, userRequest, attachedImagesUrl as any);
    const response = await ls.structedResponse(messages, schema, { provider, model });
    const messageForImageGeneration = createImageGenerationMessage("Based on attached assets and direction generate a thumbnail", response.directions[0].imageDirection, attachedImagesUrl as any);
    const url = await imageGenerationService.generateImage(messageForImageGeneration);
    return {
      imageUrl: url
    }
  },
})

export default ThumbnailGenerator;
