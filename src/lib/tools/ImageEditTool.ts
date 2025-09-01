import { tool } from "ai";
import z from "zod";
import ImageGenerationService from "../services/imageGeneration.service";
import createImageGenerationMessage from "../utils/imageGenerationMessage";

const ImageEditorTool = tool({
  name: 'image-editor-tool',
  description: 'this tool can be used to edti a thumbnail with user provided feedback, or it can also used to generate a thumbnail if a refence thumbnail is provided [!important only to use this as a generator when user provides a refenece thumbnail]',
  inputSchema: z.object({
    userRequest: z.string().describe("Edits demanded by the user."),
    attachedImagesUrl: z.array(z.string().describe("URL of the images that userd provided/attached, also the url of the thumbnail user wants to edit ")),
  }),
  execute: async ({ userRequest, attachedImagesUrl }) => {
    const imageGenerationService = new ImageGenerationService()
    const messageForImageGeneration = createImageGenerationMessage("Based on user suggestion and attached assets and direction edit a image/thumbnail", userRequest, attachedImagesUrl as any);
    const url = await imageGenerationService.generateImage(messageForImageGeneration);
    return {
      imageUrl: url
    }
  },
})

export default ImageEditorTool;
