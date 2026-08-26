import IconTile from './icon-tile'
import { IconsProvider } from './icons.context'

import type { HomeScreenProps } from './home-screen.types'

export default function HomeScreen({ state, icons }: HomeScreenProps) {
    const [dock, ...pages] = state

    return (
        <IconsProvider value={icons}>
            <div className='home-screen'>
                {pages.map((page, index) => (
                    <section key={index} className='page'>
                        <h2>
                            Page {index + 1} <span>{page.length} items</span>
                        </h2>
                        <div className='grid'>
                            {page.map(item => (
                                <IconTile key={item.displayName} item={item} />
                            ))}
                        </div>
                    </section>
                ))}
                <section className='page'>
                    <h2>
                        Dock <span>{dock.length} items</span>
                    </h2>
                    <div className='grid grid-dock'>
                        {dock.map(item => (
                            <IconTile key={item.displayName} item={item} />
                        ))}
                    </div>
                </section>
            </div>
        </IconsProvider>
    )
}
