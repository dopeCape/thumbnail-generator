export type AvaliableProvides = "openrouter" | "openai"
export type AvaliableModels = "gpt-5-mini" | "gpt-5" | "google/gemini-2.5-flash-image-preview:free"
export type LLMOpts = {
  provider: AvaliableProvides
  model: AvaliableModels
}


export type FetchMessages = { role: string, content: { type: string, text: string }[] | { type: string, image_url: { url: string } }[] }[]
