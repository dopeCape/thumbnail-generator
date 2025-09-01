export interface IAppError extends Error {
  message: string;
  status: number;
  error?: string;
}
