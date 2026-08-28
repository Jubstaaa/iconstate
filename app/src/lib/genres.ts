/**
 * App Store genre to folder mapping.
 *
 * The offline rule table only knows apps someone has already placed. For
 * anything new the store's own category is a decent second guess: no account,
 * no key, no model, and the same answer for everyone.
 *
 * The table runs from most specific to most generic and that order is the whole
 * algorithm. An app lists several genres and the one the store calls "primary"
 * is regularly the vaguer of them — Instagram leads with Photo & Video rather
 * than Social Networking. Reading in table order puts it where a person expects.
 */

export const GENRE_FOLDERS: Record<string, string> = {
    'Developer Tools': 'Dev',
    Games: 'Games',
    'Food & Drink': 'Food',
    Finance: 'Banking',
    Medical: 'Health',
    'Health & Fitness': 'Health',
    Navigation: 'Travel',
    Travel: 'Travel',
    Music: 'Music',
    'Social Networking': 'Social',
    Shopping: 'Shopping',
    Education: 'Learning',
    Books: 'Learning',
    'Magazines & Newspapers': 'Learning',
    News: 'Learning',
    Reference: 'Learning',
    Sports: 'Health',
    Weather: 'Utilities',
    'Graphics & Design': 'Photo & Video',
    'Photo & Video': 'Photo & Video',
    Entertainment: 'TV & Film',
    Business: 'Work',
    Productivity: 'Notes & Docs',
    Lifestyle: 'Shopping',
    Utilities: 'Utilities',
}

export const folderForGenres = (genres: string[]): string | null => {
    const listed = new Set(genres)
    for (const [genre, folder] of Object.entries(GENRE_FOLDERS)) {
        if (listed.has(genre)) return folder
    }
    return null
}

export const assignmentsFromGenres = (catalog: Record<string, string[]>): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const [key, genres] of Object.entries(catalog)) {
        const folder = folderForGenres(genres)
        if (folder) out[key] = folder
    }
    return out
}
