import { ZodDiscriminatedUnion, ZodObject, ZodUnion } from "zod";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText, ModelMessage } from 'ai';
import Logger from "./logger.service";
import { AppError } from "../utils/appError";
import type { AvaliableProvides, LLMOpts } from "@/types";

export default class LLMService {
  #logger = Logger

  async #errorHandler<T>(fn: () => Promise<T>) {
    try {
      return await fn()
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      throw error;
    };
  }
  public async generateText(messages: ModelMessage[], opts: LLMOpts, provideOpts?: any) {
    return this.#errorHandler(async () => {
      this.#logger.log("Invoking structed response")
      const provider = await this.#getProvider(opts.provider)
      const response = await generateText({
        model: provider(opts.model),
        messages,
        providerOptions: provideOpts
      })
      this.#logger.log("Response from llm");
      return response
    })
  }
  public async structedResponse<T extends ZodObject<any, any> | ZodDiscriminatedUnion<any, any> | ZodUnion<any>>(messages: ModelMessage[], schema: T, opts: LLMOpts, provideOpts?: any) {
    return this.#errorHandler(async () => {
      this.#logger.log("Invoking structed response")
      const provider = await this.#getProvider(opts.provider)
      const response = await generateObject({
        model: provider(opts.model),
        schema,
        messages
      })
      this.#logger.log("Response from llm", { response: response.object });
      return response.object
    })
  }

  async #getProvider(provider: AvaliableProvides) {
    return this.#errorHandler(async () => {
      switch (provider) {
        case "openrouter":
          const openrouterApiKey = process.env.OPENROUTER_API_KEY
          if (!openrouterApiKey) {
            this.#logger.error("missing openrouter api key")
            throw new AppError("openrouter", "Opps something went wrong, contact devloper to resolve this error", 500, "API key not found");
          }
          return createOpenRouter({
            apiKey: openrouterApiKey,
          });
        case "openai":
          const openAiApiKey = process.env.OPENAI_API_KEY
          if (!openAiApiKey) {
            this.#logger.error("missing openai api key")
            throw new AppError("openrouter", "Opps something went wrong, contact devloper to resolve this error", 500, "API key not found");
          }
          return createOpenAI({
            apiKey: openAiApiKey
          })
      }
    })
  }
}
