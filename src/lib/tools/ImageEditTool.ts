import { tool } from "ai";
import z from "zod";
import ImageGenerationService from "../services/imageGeneration.service";
import createImageGenerationMessage from "../utils/imageGenerationMessage";

const ImageEditorTool = tool({
  name: 'image-editor-tool',
  description: 'this tool can be used to edit a thumbnail with user provided feedback, or it can also used to generate a thumbnail if a reference thumbnail is provided [!important only to use this as a generator when user provides a reference thumbnail]',
  inputSchema: z.object({
    userRequest: z.string().describe("Edits demanded by the user or generation request."),
    attachedImagesUrl: z.array(z.string().describe("URL of the images that user provided/attached, also the url of the thumbnail user wants to edit or use as reference")),
  }),
  execute: async ({ userRequest, attachedImagesUrl }) => {
    const imageGenerationService = new ImageGenerationService();

    const systemMessage = `You are an expert thumbnail designer. Analyze the user's request and attached images to determine the appropriate approach:

**EDITING MODE** (when user wants to modify an existing thumbnail):
- Make specific adjustments to the provided thumbnail while preserving its core identity
- Focus on implementing the user's requested changes (text updates, color adjustments, element repositioning, etc.)
- Maintain the overall composition and style unless explicitly asked to change it
- Keep successful elements that are working well

**REFERENCE MODE** (when user provides reference thumbnails for inspiration):
- Study the psychological triggers, visual patterns, and design elements that make the references successful
- Adapt and combine the best elements from multiple references if provided
- Create a new thumbnail that leverages proven patterns while matching the user's specific content needs
- Focus on why the references work (composition, color psychology, text hierarchy, emotional triggers) and apply those principles
- Don't copy directly - instead intelligently adapt the successful patterns

**HYBRID MODE** (when user provides both references and specific edit requests):
- Use references to understand successful patterns and psychology
- Apply specific edits or improvements based on what makes the references effective
- Balance user requests with proven design principles from the references

**Key Principles:**
- Always prioritize mobile readability and feed performance
- Understand that references represent proven psychological patterns worth adapting
- When in doubt, extract the core success factors from references rather than surface-level copying
- Consider the user's content type and adapt reference patterns accordingly

Analyze the user request and images to determine which approach is most appropriate, then execute accordingly.`;

    const messageForImageGeneration = createImageGenerationMessage(
      systemMessage,
      userRequest,
      attachedImagesUrl as any
    );

    const url = await imageGenerationService.generateImage(messageForImageGeneration);

    return {
      imageUrl: url
    };
  },
});

export default ImageEditorTool;
