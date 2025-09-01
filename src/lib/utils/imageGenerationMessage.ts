import { FetchMessages } from "@/types";

export default function createImageGenerationMessage(sysprompt: string, usermessage: string, image: string[]): FetchMessages {
  const message: FetchMessages = [];
  message.push({ role: "system", content: [{ type: "text", text: sysprompt }] });
  message.push({ role: "user", content: [{ type: "text", text: usermessage }] });
  image.forEach((img) => {
    message.push({ role: "user", content: [{ type: "image_url", image_url: { url: img } }] });
  });
  return message

}
