interface PageDotsProps {
    count: number
    active: number
    onGo: (page: number) => void
}

export default function PageDots({ count, active, onGo }: PageDotsProps) {
    return (
        <div className='flex items-center justify-center gap-2'>
            {Array.from({ length: count }, (_, page) => (
                <button
                    key={page}
                    aria-label={`Page ${page + 1}`}
                    onClick={() => onGo(page)}
                    className={`size-[7px] rounded-full transition ${
                        page === active ? 'bg-white' : 'bg-white/35 hover:bg-white/60'
                    }`}
                />
            ))}
        </div>
    )
}
