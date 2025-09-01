import { FilePart, ImagePart, ModelMessage, TextPart } from "ai";
import fs from "fs/promises"
import ImageGenerationService from "@/lib/services/imageGeneration.service";
import createImageGenerationMessage from "@/lib/utils/imageGenerationMessage";

export async function GET() {
  const igs = new ImageGenerationService()
  const m = createImageGenerationMessage("Based on attached assets and direction generate a thumbnail", "Engagement Maximizer — High-CTR, curiosity-driven thumbnail using the uploaded portrait as the emotional anchor. Crop the provided photo to a tight 3:4 portrait (face + torso) and place the presenter on the left third of the frame so their head/eyes occupy ~40–50% of the left area; boost eye sharpness and saturation of the jacket slightly to increase facial magnetism. On the right third place a large, glossy 3D globe (angled so Africa/Europe are visible) with layered, high-contrast pictograms bursting out (pyramid, Roman column, steam engine, fighter jet, rocket) to create an “unexpected juxtaposition” curiosity gap. Add a bold two-word headline in caps: “WORLD HISTORY” with a large white stroke and a warm red/orange fill; position it top-right over a semi-transparent dark vignette so it reads strongly on mobile. Use a red curved arrow pointing from presenter’s gaze/point to the globe to create a visual line. Lighting: punchy key from upper-left on presenter, rim light on globe to separate it from background. Color palette: #FF4C3B (accent), #FFD166 (secondary), #0B132B (deep contrast), #FFFFFF (text). Typography: Impact-like heavy sans, 48–72pt scaled for 1280×720. Camera angle: eye level, slight tilt for dynamism. Psychological goal: immediate emotional shock + curiosity gap to drive impulse clicks.", ["https://hh0a5gb2wh08hqtq.public.blob.vercel-storage.com/tejas.JPG"]);
  const url = await igs.generateImage(m)
  return Response.json(url);
}


function createMessage(sysprompt: string, usermessage: string, image: Buffer<ArrayBufferLike>[]): ModelMessage[] {
  const message: ModelMessage[] = [];
  message.push({ role: "system", content: sysprompt });
  message.push({ role: "user", content: usermessage });
  image.forEach((img) => {
    console.log(img)
    message.push({ role: "user", content: [{ type: "image", image: img }] });
  });
  return message
}

async function getImage() {
  const imageData = await fs.readFile("/home/baby/Downloads/tejas.JPG")
  return imageData
}
