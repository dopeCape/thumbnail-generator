import ImageEditorTool from '@/lib/tools/ImageEditTool';
import ThumbnailGenerator from '@/lib/tools/ThumbnailGenerator';
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, tool, UIMessage } from 'ai';
import z from 'zod';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  console.log(messages[0].parts)
  const result = streamText({
    model: openai('gpt-4o'),
    system: `You are a helpful assistant.
just few rules to follow:
when ever showing a image, show it in markdown preview format 
![Alt text](image-url) always folow this format
`,
    messages: convertToModelMessages(messages),
    tools: {
      dogsNames: testTool,
      thumbnailGenerator: ThumbnailGenerator,
      imageEditor: ImageEditorTool
    }
  });
  return result.toUIMessageStreamResponse();
}

const testTool = tool({
  name: 'dog-name-tool',
  description: 'you can call this tool to get all the avaliable dogs ',
  inputSchema: z.object({
  }),
  execute: async ({ }) => {
    return {
      names: ["alias", "monkey", "bruno"]
    }
  },
})
