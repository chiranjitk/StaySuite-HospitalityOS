"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

/**
 * Safely convert a value to a renderable string.
 * Handles objects, arrays, Error instances, and primitives.
 */
function safeStringify(value: React.ReactNode): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (React.isValidElement(value)) return value
  // Handle Error objects, plain objects {code, message}, etc.
  if (typeof value === 'object') {
    // Error instance
    if (value instanceof Error) return value.message
    // Object with message property (e.g. {code, message})
    const obj = value as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
    if (typeof obj.error === 'object' && obj.error !== null && 'message' in (obj.error as object)) {
      return String((obj.error as { message: unknown }).message)
    }
    // Fallback: JSON stringify
    try {
      return JSON.stringify(obj)
    } catch {
      return String(obj)
    }
  }
  return String(value)
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Safely convert title and description to renderable content
        const safeTitle = safeStringify(title)
        const safeDescription = safeStringify(description)

        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {safeTitle && <ToastTitle>{safeTitle}</ToastTitle>}
              {safeDescription && (
                <ToastDescription>{safeDescription}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
