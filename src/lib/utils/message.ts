import { ModelMessage } from "ai";

export default function createMessage(sysprompt: string, usermessage: string, image: Buffer<ArrayBufferLike>[]): ModelMessage[] {
  const message: ModelMessage[] = [];
  message.push({ role: "system", content: sysprompt });
  message.push({ role: "user", content: usermessage });
  image.forEach((img) => {
    message.push({ role: "user", content: [{ type: "image", image: img }] });
  });
  return message
}
