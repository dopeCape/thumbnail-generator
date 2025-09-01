import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import VectorDbService from './vectorDb.service';
import LLMService from './llm.service';
import Logger from './logger.service';
import dotenv from "dotenv"
import createMessage from '../utils/message';

dotenv.config({ path: "<-- path to env -->" });

// Zod schema for thumbnail metadata
const ThumbnailMetadataSchema = z.object({
  content_type: z.string().describe("Type of content like 'tech review', 'gaming reaction', 'cooking tutorial'"),
  visual_style: z.string().describe("Visual layout like 'split screen comparison', 'shocked face dominant', 'product showcase'"),
  psychological_vibe: z.string().describe("Psychological appeal like 'curiosity driven', 'authoritative', 'exciting'"),
  color_energy: z.string().describe("Color palette energy like 'vibrant', 'muted', 'monochrome', 'neon', 'warm', 'cool'"),
  composition_complexity: z.string().describe("Visual complexity like 'minimal', 'balanced', 'busy', 'chaotic'"),
  channel_name: z.string().describe("Name of the YouTube channel"),
  semantic_description: z.string().describe("Detailed description of what makes this thumbnail effective")
});

type ThumbnailMetadata = z.infer<typeof ThumbnailMetadataSchema>;

interface ThumbnailFile {
  filePath: string;
  fileName: string;
  channelName: string;
  videoId: string;
  videoTitle: string;
  viewCount: number;
  thumbnailUrl: string;
}
export default class ThumbnailVectorizer {
  private vectorDb = new VectorDbService();
  private llm = new LLMService();
  private logger = Logger;
  private thumbnailsDir = '<-- path to scraped thumbails -->';
  private indexName = 'thumbnail-references';

  async processAllThumbnails(): Promise<void> {
    this.logger.log("Starting thumbnail vectorization process");

    try {
      const thumbnailFiles = await this.getAllThumbnailFiles();
      this.logger.log(`Found ${thumbnailFiles.length} thumbnail files to process`);
      const batchSize = 5;
      const batches = this.chunkArray(thumbnailFiles, batchSize);

      let processedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.logger.log(`Processing batch ${i + 1}/${batches.length}`);

        const batchResults = await Promise.allSettled(
          batch.map(file => this.processThumbnail(file))
        );

        // Count successes and failures
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            processedCount++;
            this.logger.log(`✅ Processed: ${batch[index].fileName}`);
          } else {
            errorCount++;
            this.logger.error(`❌ Failed: ${batch[index].fileName}`, result.reason);
          }
        });

        // Add delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      this.logger.log(`Vectorization complete: ${processedCount} successful, ${errorCount} failed`);

    } catch (error) {
      this.logger.error("Error in thumbnail vectorization process", error);
      throw error;
    }
  }

  private async getAllThumbnailFiles(): Promise<ThumbnailFile[]> {
    const thumbnailFiles: ThumbnailFile[] = [];

    // Read all channel directories
    const channelDirs = fs.readdirSync(this.thumbnailsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const channelDir of channelDirs) {
      const channelPath = path.join(this.thumbnailsDir, channelDir);

      // Load metadata to get video info
      const metadataPath = path.join(channelPath, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        this.logger.warn(`No metadata found for channel: ${channelDir}`);
        continue;
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      // Get all image files
      const imageFiles = fs.readdirSync(channelPath)
        .filter(file => file.endsWith('.jpg') || file.endsWith('.png'))
        .map(file => {
          const filePath = path.join(channelPath, file);

          // Extract video ID from filename (assuming format: N_title_videoId.jpg)
          const parts = file.split('_');
          const videoId = parts[parts.length - 1].replace(/\.(jpg|png)$/, '');

          // Find corresponding video metadata
          const videoData = metadata.videos.find((v: any) => v.videoId === videoId);

          return {
            filePath,
            thumbnailUrl: videoData?.thumbnailUrl,
            fileName: file,
            channelName: metadata.channelName,
            videoId,
            videoTitle: videoData?.title || 'Unknown',
            viewCount: videoData?.viewCount || 0
          };
        });

      thumbnailFiles.push(...imageFiles);
    }

    return thumbnailFiles;
  }

  private async processThumbnail(file: ThumbnailFile): Promise<void> {
    try {

      const metadata = await this.generateMetadata(file.thumbnailUrl, file);

      const semanticText = this.createSemanticDescription(metadata, file);

      const id = `${file.channelName}_${file.videoId}`.replace(/[^a-zA-Z0-9_-]/g, '_');

      const vectorMetadata = {
        ...metadata,
        video_title: file.videoTitle,
        url: file.thumbnailUrl,
        view_count: file.viewCount,
        processed_at: new Date().toISOString()
      };

      await this.vectorDb.save(
        semanticText,
        id,
        vectorMetadata,
        {
          index: this.indexName,
          namespace: 'thumbnails'
        }
      );

    } catch (error) {
      this.logger.error(`Failed to process thumbnail: ${file.fileName}`, error);
      throw error;
    }
  }

  private async generateMetadata(
    imageUrl: string,
    file: ThumbnailFile
  ): Promise<ThumbnailMetadata> {

    const systemPrompt = `You are an expert YouTube thumbnail analyzer. Analyze the provided thumbnail image and extract metadata that describes its visual and psychological characteristics.

Focus on these key aspects:
- content_type: What type of content this thumbnail represents
- visual_style: The primary visual layout/composition approach
- psychological_vibe: The psychological appeal or emotion it triggers
- color_energy: The overall color palette and energy level
- composition_complexity: How busy or minimal the visual design is
- semantic_description: A detailed description of why this thumbnail works psychologically

Be specific and use consistent terminology that would help match similar thumbnails.`;

    const userPrompt = `Analyze this YouTube thumbnail image and provide structured metadata.

Channel: ${file.channelName}
Video Title: ${file.videoTitle}
View Count: ${(file.viewCount / 1000000).toFixed(1)}M views

Please analyze the thumbnail's visual and psychological characteristics.`;

    const messages = createMessage(systemPrompt, userPrompt, [imageUrl as any])
    const result = await this.llm.structedResponse(
      messages,
      ThumbnailMetadataSchema,
      {
        provider: 'openai',
        model: 'gpt-5'
      }
    );

    return {
      ...result,
      channel_name: file.channelName // Ensure channel name is included
    };
  }

  private createSemanticDescription(metadata: ThumbnailMetadata, file: ThumbnailFile): string {
    return `${metadata.content_type} thumbnail with ${metadata.visual_style} layout. 
    Features ${metadata.psychological_vibe} psychology with ${metadata.color_energy} colors and ${metadata.composition_complexity} composition. 
    From ${metadata.channel_name} channel. ${metadata.semantic_description}`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async findSimilarThumbnails(
    query: string,
    topK: number = 5,
    filters?: Record<string, string>
  ) {
    try {
      const results = await this.vectorDb.topK(
        query,
        topK,
        {
          index: this.indexName,
          nameSpace: 'thumbnails',
          includeMetadata: true,
          filter: filters
        }
      );

      return results.map(match => ({
        score: match.score,
        metadata: match.metadata,
        id: match.id
      }));

    } catch (error) {
      this.logger.error("Error searching thumbnails", error);
      throw error;
    }
  }
}
