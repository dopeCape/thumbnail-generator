import { IAppError } from "@/types";
export default function errorResponse(error: IAppError) {
  return Response.json(error.message, { status: error.status, statusText: error.message })
} 
