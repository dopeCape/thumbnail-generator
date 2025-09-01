import ThumbnailVectorizer from "../services/thumbnail.service";


async function main() {
  const vectorizer = new ThumbnailVectorizer();

  try {
    await vectorizer.processAllThumbnails();
    console.log("All thumbnails have been processed and stored in vector database");

    const testResults = await vectorizer.findSimilarThumbnails(
      "tech review with product comparison",
      3
    );
    console.log("Test search results:", testResults);

  } catch (error) {
    console.error("Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { ThumbnailVectorizer };
