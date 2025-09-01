import { Pinecone } from '@pinecone-database/pinecone';
import EmbeddingsService from './embeddings.service';
import Logger from './logger.service';


export default class VectorDbService {
  private logger = Logger;
  private pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY as string,
    maxRetries: 10,
  });
  private embeddingService = new EmbeddingsService();
  public async save(data: string, id: string, metadata: Record<string, any>, opts: {
    index: string,
    namespace?: string,
  }) {
    this.logger.log("Saving to vector db", { data, metadata });
    const embeddings = await this.embeddingService.embed(data);
    const namespace = this.pinecone.index(opts.index).namespace(opts.namespace || "")
    await namespace.upsert([
      {
        id,
        values: embeddings,
        metadata,
      }
    ])
  }
  public async saveMultiple(records: { data: string, id: string, metadata: Record<string, any> }[], opts: {
    index: string,
    namespace?: string,
  }) {
    try {
      this.logger.log("Saving to vector db", { records });
      const embaddedData = await Promise.all(records.map(async (record) => {
        const embeddings = await this.embeddingService.embed(record.data);
        return {
          id: record.id,
          values: embeddings,
          metadata: record.metadata
        }
      }))
      const namespace = this.pinecone.index(opts.index).namespace(opts.namespace || "")
      await namespace.upsert(embaddedData)
    } catch (error) {
      console.log(error);
      throw error
    }

  }


  public async topK(query: string, topK: number, opts: {
    index: string,
    nameSpace?: string,
    includeMetadata: boolean
    filter?: Record<string, string>
  }) {
    this.logger.log("Getting top k", { query, topK, opts });
    const embeddings = await this.embeddingService.embed(query);
    const namespace = this.pinecone.index(opts.index).namespace(opts.nameSpace || "");
    const topKResults = await namespace.query({
      vector: embeddings,
      topK: topK,
      includeMetadata: opts.includeMetadata,
      filter: opts.filter
    })
    this.logger.log("top k results", { topKResults });
    return topKResults.matches
  }
  public async batchTopK(queries: string[], topK: number, opts: {
    index: string,
    nameSpace?: string,
    includeMetadata: boolean
    filter?: Record<string, string>,
    concurrency?: number // Control concurrent requests
  }) {
    this.logger.log("Getting batch top k", { queries, topK, opts });

    const embeddings = await Promise.all(
      queries.map(query => this.embeddingService.embed(query))
    );

    const namespace = this.pinecone.index(opts.index).namespace(opts.nameSpace || "");

    const concurrency = opts.concurrency || 5
    const results: any[] = [];

    for (let i = 0; i < embeddings.length; i += concurrency) {
      const batch = embeddings.slice(i, i + concurrency);
      const batchQueries = queries.slice(i, i + concurrency);

      this.logger.log(`Processing batch ${Math.floor(i / concurrency) + 1}`, {
        batchSize: batch.length,
        queries: batchQueries
      });

      const batchResults = await Promise.all(
        batch.map(async (embedding, index) => {
          try {
            const result = await namespace.query({
              vector: embedding,
              topK: topK,
              includeMetadata: opts.includeMetadata,
              filter: opts.filter
            });
            return {
              query: batchQueries[index],
              matches: result.matches,
              success: true
            };
          } catch (error) {
            this.logger.error(`Failed to query for: ${batchQueries[index]}`, error);
            return {
              query: batchQueries[index],
              matches: [],
              success: false,
              error
            };
          }
        })
      );
      results.push(...batchResults);
      if (i + concurrency < embeddings.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    this.logger.log("Batch top k results", {
      totalQueries: queries.length,
      successfulQueries: results.filter(r => r.success).length,
      failedQueries: results.filter(r => !r.success).length
    });
    return results;
  }
}
