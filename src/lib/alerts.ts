import { toast } from 'sonner'

interface AlertOptions {
  description?: string
  duration?: number
  id?: string | number
}

export const alerts = {
  success: (message: string, options?: AlertOptions) => toast.success(message, options),
  error: (message: string, options?: AlertOptions) => toast.error(message, options),
  warning: (message: string, options?: AlertOptions) => toast.warning(message, options),
  info: (message: string, options?: AlertOptions) => toast.info(message, options),
}
