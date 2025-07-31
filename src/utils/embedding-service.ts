/**
 * @fileoverview Embedding Service for Text Vectorization
 * 
 * Provides text-to-vector embedding generation using Transformers.js.
 * Supports local execution of sentence-transformers models for semantic similarity.
 */

import { pipeline, env } from '@xenova/transformers';

// Configure transformers to allow remote model downloads for first-time setup
env.allowRemoteModels = true;
env.allowLocalModels = true;

export interface EmbeddingConfig {
  model: string;
  maxLength: number;
  batchSize: number;
  cacheDir?: string;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  processingTime: number;
  tokenCount?: number;
}

/**
 * Embedding service for generating text embeddings using local models
 */
export class EmbeddingService {
  private pipeline: any = null;
  private modelLoaded = false;
  private loadingPromise: Promise<void> | null = null;
  
  private config: EmbeddingConfig = {
    model: 'Xenova/all-MiniLM-L6-v2', // 384-dimensional embeddings
    maxLength: 512,
    batchSize: 8,
  };

  constructor(config?: Partial<EmbeddingConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // Set cache directory if provided
    if (this.config.cacheDir) {
      env.cacheDir = this.config.cacheDir;
    }
  }

  /**
   * Initialize the embedding model (lazy loading)
   */
  private async initializeModel(): Promise<void> {
    if (this.modelLoaded) return;
    
    if (this.loadingPromise) {
      await this.loadingPromise;
      return;
    }

    this.loadingPromise = this._loadModel();
    await this.loadingPromise;
  }

  private async _loadModel(): Promise<void> {
    try {
      console.error(`🔄 Loading embedding model: ${this.config.model}`);
      const startTime = Date.now();
      
      this.pipeline = await pipeline('feature-extraction', this.config.model, {
        quantized: true, // Use quantized model for better performance
        progress_callback: (progress: any) => {
          if (progress.status === 'downloading') {
            const percent = progress.progress ? Math.round(progress.progress * 100) : 0;
            console.error(`📥 Downloading ${progress.file}: ${percent}%`);
          }
        }
      });
      
      const loadTime = Date.now() - startTime;
      console.error(`✅ Embedding model loaded successfully in ${loadTime}ms`);
      console.error(`📊 Model: ${this.config.model} (384-dimensional vectors)`);
      
      this.modelLoaded = true;
      this.loadingPromise = null;
    } catch (error) {
      console.error('❌ Failed to load embedding model:', error);
      this.loadingPromise = null;
      throw new Error(`Failed to load embedding model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    await this.initializeModel();
    
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const startTime = Date.now();
    
    try {
      // Truncate text if too long
      const truncatedText = text.length > this.config.maxLength * 4 
        ? text.substring(0, this.config.maxLength * 4) + '...'
        : text;

      // Generate embedding
      const output = await this.pipeline(truncatedText, {
        pooling: 'mean',
        normalize: true,
      });

      // Extract the embedding array
      const embedding: number[] = Array.from(output.data);
      const processingTime = Date.now() - startTime;

      // Validate embedding dimensions
      if (embedding.length !== 384) {
        throw new Error(`Expected 384-dimensional embedding, got ${embedding.length} dimensions`);
      }

      console.error(`🎯 Generated embedding for text (${text.length} chars) in ${processingTime}ms`);

      return {
        embedding,
        model: this.config.model,
        processingTime,
        tokenCount: Math.ceil(truncatedText.length / 4), // Rough token estimate
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Embedding generation failed after ${processingTime}ms:`, error);
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    await this.initializeModel();
    
    const results: EmbeddingResult[] = [];
    const totalStartTime = Date.now();

    // Process in batches
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      console.error(`📦 Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(texts.length / this.config.batchSize)} (${batch.length} texts)`);

      // Generate embeddings for batch
      const batchPromises = batch.map(text => this.generateEmbedding(text));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to prevent overwhelming the system
      if (i + this.config.batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const totalTime = Date.now() - totalStartTime;
    console.error(`✅ Generated ${results.length} embeddings in ${totalTime}ms (avg: ${Math.round(totalTime / results.length)}ms per embedding)`);

    return results;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Check if the model is loaded and ready
   */
  isReady(): boolean {
    return this.modelLoaded;
  }

  /**
   * Get current configuration
   */
  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    if (this.pipeline) {
      // Transformers.js doesn't have explicit disposal, but we can clear the reference
      this.pipeline = null;
      this.modelLoaded = false;
      console.error('🧹 Embedding service disposed');
    }
  }
}

// Singleton instance for application-wide use
let embeddingServiceInstance: EmbeddingService | null = null;

/**
 * Get the singleton embedding service instance
 */
export function getEmbeddingService(config?: Partial<EmbeddingConfig>): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService(config);
  }
  return embeddingServiceInstance;
}

/**
 * Dispose the singleton embedding service
 */
export async function disposeEmbeddingService(): Promise<void> {
  if (embeddingServiceInstance) {
    await embeddingServiceInstance.dispose();
    embeddingServiceInstance = null;
  }
}