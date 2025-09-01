import { embed, embedMany } from "ai";
import Logger from "./logger.service";
import { openai } from "@ai-sdk/openai";

export default class EmbeddingsService {
  #EMBEDDING_MODEL = 'text-embedding-3-small'
  #logger = Logger

  async embed(text: string): Promise<number[]> {
    this.#logger.log("creatine single embedding", { text });
    const { embedding } = await embed({
      model: openai.textEmbeddingModel(this.#EMBEDDING_MODEL),
      value: text,
    });
    this.#logger.log("Created embeddings");
    return embedding
  }

  async embedMany(values: string[]): Promise<number[][]> {
    this.#logger.log("creatine many embeddings", { values });
    const { embeddings } = await embedMany({
      model: openai.textEmbeddingModel(this.#EMBEDDING_MODEL),
      values
    });
    this.#logger.log("Created embeddings");
    return embeddings
  }
}

