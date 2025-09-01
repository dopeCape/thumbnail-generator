import { ZodDiscriminatedUnion, ZodObject, ZodUnion } from "zod";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText, ModelMessage } from 'ai';
import { AppError } from "../utils/appError";
import type { AvaliableProvides, LLMOpts } from "@/types";
import Logger from "./logger.service";
import RetryHandler from "../utils/retry";

export default class LLMService {
  #logger = Logger;

  async #errorHandler<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw error;
    }
  }

  public async generateText(messages: ModelMessage[], opts: LLMOpts, provideOpts?: any) {
    return this.#errorHandler(async () => {
      return await RetryHandler.withRetry(
        async () => {
          this.#logger.log("Invoking text generation");
          const provider = await this.#getProvider(opts.provider);
          const response = await generateText({
            model: provider(opts.model),
            messages,
            providerOptions: provideOpts
          });
          this.#logger.log("Text generation response received");
          return response;
        },
        2,
        2000,
        `Text Generation (${opts.provider}/${opts.model})`
      );
    });
  }

  public async structedResponse<T extends ZodObject<any, any> | ZodDiscriminatedUnion<any, any> | ZodUnion<any>>(
    messages: ModelMessage[],
    schema: T,
    opts: LLMOpts,
  ) {
    return this.#errorHandler(async () => {
      return await RetryHandler.withRetry(
        async () => {
          this.#logger.log("Invoking structured response");
          const provider = await this.#getProvider(opts.provider);
          const response = await generateObject({
            model: provider(opts.model),
            schema,
            messages
          });
          this.#logger.log("Structured response received", { response: response.object });
          return response.object;
        },
        2,
        2000,
        `Structured Response (${opts.provider}/${opts.model})`
      );
    });
  }

  async #getProvider(provider: AvaliableProvides) {
    return this.#errorHandler(async () => {
      return await RetryHandler.withRetry(
        async () => {
          switch (provider) {
            case "openrouter":
              const openrouterApiKey = process.env.OPENROUTER_API_KEY;
              if (!openrouterApiKey) {
                this.#logger.error("missing openrouter api key");
                throw new AppError("openrouter", "Opps something went wrong, contact developer to resolve this error", 500, "API key not found");
              }
              return createOpenRouter({
                apiKey: openrouterApiKey,
              });

            case "openai":
              const openAiApiKey = process.env.OPENAI_API_KEY;
              if (!openAiApiKey) {
                this.#logger.error("missing openai api key");
                throw new AppError("openai", "Opps something went wrong, contact developer to resolve this error", 500, "API key not found");
              }
              return createOpenAI({
                apiKey: openAiApiKey
              });

            default:
              throw new Error(`Unsupported provider: ${provider}`);
          }
        },
        1,
        1000,
        `Provider Initialization (${provider})`
      );
    });
  }
}
