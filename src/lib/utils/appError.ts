import { IAppError } from "@/types/AppError.type";

export class AppError implements IAppError {
  message: string;
  status: number;
  error: string | undefined;
  name: string
  constructor(name: string, message: string, status: number, error?: string) {
    this.name = name;
    this.message = message;
    this.status = status;
    this.error = error;
  }
}
