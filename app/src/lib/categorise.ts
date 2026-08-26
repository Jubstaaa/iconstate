import type { Assignments, CategoriseRequest } from './categorise.types'

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-5'
const API_KEY_STORAGE = 'iconstate.anthropic-key'

const TOOL = {
    name: 'assign_folders',
    description: 'Assign every app to exactly one home screen folder.',
    input_schema: {
        type: 'object',
        properties: {
            assignments: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        key: { type: 'string', description: 'The app bundle identifier, copied verbatim' },
                        folder: { type: 'string', description: 'The folder name to put it in' },
                    },
                    required: ['key', 'folder'],
                },
            },
        },
        required: ['assignments'],
    },
}

export const readApiKey = (): string => {
    try {
        return localStorage.getItem(API_KEY_STORAGE) ?? ''
    } catch {
        return ''
    }
}

export const saveApiKey = (value: string): void => {
    try {
        if (value) localStorage.setItem(API_KEY_STORAGE, value)
        else localStorage.removeItem(API_KEY_STORAGE)
    } catch {
        // a private window with storage disabled just means the key is not remembered
    }
}

export const categorise = async ({ apiKey, apps, folders }: CategoriseRequest): Promise<Assignments> => {
    const prompt = [
        'Put each of these iPhone apps into one home screen folder.',
        '',
        'Prefer an existing folder. Only invent a new name when nothing existing fits,',
        'and keep new names to one or two words.',
        '',
        `Existing folders: ${folders.join(', ')}`,
        '',
        'Apps:',
        ...apps.map(app => `${app.key} — ${app.displayName}`),
    ].join('\n')

    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 4096,
            tools: [TOOL],
            tool_choice: { type: 'tool', name: TOOL.name },
            messages: [{ role: 'user', content: prompt }],
        }),
    })

    if (!response.ok) {
        const detail = await response.text()
        throw new Error(`Claude refused the request (${response.status}): ${detail.slice(0, 200)}`)
    }

    const payload = (await response.json()) as {
        content: {
            type: string
            name?: string
            input?: { assignments?: { key: string; folder: string }[] }
        }[]
    }
    const call = payload.content.find(block => block.type === 'tool_use' && block.name === TOOL.name)
    const assignments = call?.input?.assignments ?? []

    const wanted = new Set(apps.map(app => app.key))
    return Object.fromEntries(
        assignments.filter(entry => wanted.has(entry.key)).map(entry => [entry.key, entry.folder])
    )
}
