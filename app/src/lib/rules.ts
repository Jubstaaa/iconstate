/**
 * The folder layout the app proposes before it knows anything about you.
 *
 * Only Apple's own apps are listed: they are on every iPhone, and which ones a
 * person has says nothing about them. Everything else is left to the App Store's
 * own category, or to the table you build from your own home screen — see
 * `~/.iconstate/rules.json`.
 *
 * Keyed by bundle identifier because display names are ambiguous and carry
 * invisible characters.
 */

/**
 * Left empty on purpose. The dock is a personal choice and a sort has no
 * business rearranging it, so planning keeps whatever is already there.
 */
export const DOCK: readonly string[] = []

export const FOLDER_ORDER: readonly string[] = [
    'Apple',
    'Passwords',
    'Learning',
    'Smart Home',
    'Health',
    'Shopping',
    'Food',
    'Tickets',
    'Photo & Video',
    'Music',
    'Notes & Docs',
    'Banking',
    'Transport',
    'Work',
    'Dev',
    'AI',
    'Mail & Calendar',
    'Travel',
    'TV & Film',
    'Internet',
    'Utilities',
    'Messaging',
    'Social',
    'Games',
]

/** Insertion order is the order inside each folder; keep it. */
export const RULES: Record<string, string> = {
    // Apple
    'com.apple.AppStore': 'Apple',
    'com.apple.store.Jolly': 'Apple',
    'com.apple.tips': 'Apple',
    'com.apple.supportapp': 'Apple',
    // Passwords
    'com.apple.Passwords': 'Passwords',
    // Smart Home
    'com.apple.Home': 'Smart Home',
    // Health
    'com.apple.Health': 'Health',
    'com.apple.Fitness': 'Health',
    'com.apple.Bridge': 'Health',
    // Photo & Video
    'com.apple.mobileslideshow': 'Photo & Video',
    'com.apple.camera': 'Photo & Video',
    'com.apple.iMovie': 'Photo & Video',
    // Music
    'com.apple.Music': 'Music',
    // Notes & Docs
    'com.apple.mobilenotes': 'Notes & Docs',
    'com.apple.journal': 'Notes & Docs',
    'com.apple.freeform': 'Notes & Docs',
    'com.apple.reminders': 'Notes & Docs',
    'com.apple.VoiceMemos': 'Notes & Docs',
    'com.apple.DocumentsApp': 'Notes & Docs',
    'com.apple.Keynote': 'Notes & Docs',
    'com.apple.Preview': 'Notes & Docs',
    // Banking
    'com.apple.Passbook': 'Banking',
    // Dev
    'com.apple.TestFlight': 'Dev',
    'com.apple.AppStoreConnect': 'Dev',
    // AI
    'com.apple.GenerativePlaygroundApp': 'AI',
    // Mail & Calendar
    'com.apple.mobilemail': 'Mail & Calendar',
    'com.apple.mobilecal': 'Mail & Calendar',
    // Travel
    'com.apple.Maps': 'Travel',
    // TV & Film
    'com.apple.tv': 'TV & Film',
    // Internet
    'com.apple.mobilesafari': 'Internet',
    // Utilities
    'com.apple.mobiletimer': 'Utilities',
    'com.apple.calculator': 'Utilities',
    'com.apple.compass': 'Utilities',
    'com.apple.Magnifier': 'Utilities',
    'com.apple.measure': 'Utilities',
    'com.apple.Translate': 'Utilities',
    'com.apple.findmy': 'Utilities',
    'com.apple.shortcuts': 'Utilities',
    'com.apple.weather': 'Utilities',
    'com.apple.Preferences': 'Utilities',
    'com.apple.MobileAddressBook': 'Utilities',
    // Messaging
    'com.apple.mobilephone': 'Messaging',
    'com.apple.MobileSMS': 'Messaging',
    'com.apple.facetime': 'Messaging',
    // Games
    'com.apple.games': 'Games',
}

export interface UserRules {
    dock: string[]
    folderOrder: string[]
    rules: Record<string, string>
}
