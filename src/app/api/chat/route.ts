import ImageEditorTool from '@/lib/tools/ImageEditTool';
import ThumbnailGenerator from '@/lib/tools/ThumbnailGenerator';
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, tool, UIMessage } from 'ai';

export const maxDuration = 120;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  console.log(messages[0].parts)
  const result = streamText({
    model: openai('gpt-4o'),
    system: `You are a helpful assistant.

## Tool Selection Rules:

**Use thumbnailGenerator when:**
- User wants to create a new thumbnail from scratch
- User provides only their own photos/assets (not existing thumbnails)
- User describes what they want in a thumbnail

**Use imageEditor when:**
- User provides existing thumbnail images as references
- User uploads any images that could be thumbnails (even if not explicitly mentioned as references)
- User wants to modify or improve existing thumbnails

## Output Format:
Always display images using markdown format: ![Alt text](image-url)

**Important:** Pass user requests to tools exactly as provided - do not modify or rephrase the user's words. 
`,
    messages: convertToModelMessages(messages),
    tools: {
      thumbnailGenerator: ThumbnailGenerator,
      imageEditor: ImageEditorTool
    }
  });
  return result.toUIMessageStreamResponse();
}
