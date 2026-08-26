import { toast } from 'sonner'

const WORK = 'iconstate-work'

/** One toast per operation, updated in place as progress arrives. */
export const notifyProgress = (message: string) => toast.loading(message, { id: WORK, duration: Infinity })

export const notifyDone = (message: string) => toast.success(message, { id: WORK, duration: 2200 })

export const notifyFailed = (message: string) => toast.error(message, { id: WORK, duration: 6000 })

export const notifyIdle = () => toast.dismiss(WORK)
