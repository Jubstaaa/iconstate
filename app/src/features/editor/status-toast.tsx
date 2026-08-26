import { AnimatePresence, motion } from 'motion/react'

interface StatusToastProps {
    message: string
    busy: boolean
}

export default function StatusToast({ message, busy }: StatusToastProps) {
    return (
        <AnimatePresence>
            {busy && message ? (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                    className='pointer-events-none absolute inset-x-0 bottom-[13%] z-30 flex justify-center'
                >
                    <span className='rounded-full bg-black/70 px-3 py-1.5 text-[11px] text-white backdrop-blur-xl'>
                        {message}
                    </span>
                </motion.div>
            ) : null}
        </AnimatePresence>
    )
}
