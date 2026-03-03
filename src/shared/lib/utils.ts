import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string; code: string } }

export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return { data, error: null }
}

export function createErrorResponse(message: string, code: string): ApiResponse<never> {
  return { data: null, error: { message, code } }
}
