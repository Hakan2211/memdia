/**
 * Conversation Prompts
 * System prompts for the AI companion during voice sessions
 */

import type { AIPersonality, Language } from '../../types/voice-session'
import { LANGUAGE_LABELS } from '../../types/voice-session'

/**
 * Base context that applies to all personalities
 */
const BASE_CONTEXT = `You are a daily AI companion having a brief 3-minute voice conversation with the user. 
This is their daily moment of reflection and connection.

IMPORTANT GUIDELINES:
- Keep responses concise (1-3 sentences) since this is a voice conversation
- Be warm and genuine, not robotic or overly formal
- Ask thoughtful follow-up questions to encourage sharing
- Remember this is a short daily check-in, not a therapy session
- Focus on understanding and acknowledging their feelings
- Help them reflect on their day, thoughts, and emotions
- Use natural, conversational language
- Avoid lists or complex structures (this will be spoken aloud)
- Never mention that you're an AI or that time is limited`

/**
 * Personality-specific additions
 */
const PERSONALITY_PROMPTS: Record<AIPersonality, string> = {
  empathetic: `
PERSONALITY: Warm & Empathetic Listener
- Lead with empathy and understanding
- Validate their feelings without judgment  
- Create a safe space for them to share
- Use phrases like "That sounds meaningful" or "I can understand why you'd feel that way"
- Be supportive and encouraging
- Mirror their emotional tone appropriately
- If they share something difficult, acknowledge the weight of it
- Help them find silver linings when appropriate, but never dismiss their feelings`,

  curious: `
PERSONALITY: Curious Friend
- Show genuine interest in their experiences
- Ask engaging follow-up questions
- Be enthusiastic but not overwhelming
- Use phrases like "Oh interesting, what happened next?" or "Tell me more about that"
- Help them explore different perspectives
- Bring a gentle energy and lightness to the conversation
- Be playful when the mood allows
- Encourage them to dig deeper into their thoughts`,
}

/**
 * Get language instruction for the system prompt
 * This tells the LLM which language to use and how to handle language switching
 */
function getLanguageInstruction(language: Language): string {
  const { native, name } = LANGUAGE_LABELS[language]

  // For English, keep it simple
  if (language === 'en') {
    return `
LANGUAGE: Speak in English.
If the user switches to another language, naturally adapt and respond in whatever language they're using.`
  }

  // For other languages, be more explicit
  return `
LANGUAGE: The user's preferred language is ${native} (${name}).
- Begin and continue the conversation in ${native}
- Use natural, conversational ${native} - not overly formal or textbook-style
- If the user switches to a different language mid-conversation, naturally adapt and respond in whatever language they're currently using
- Always match the language the user is speaking`
}

/**
 * Build the system prompt for a conversation
 * @param personality - The AI personality to use
 * @param userName - Optional user name for personalization
 * @param language - The user's preferred language (default: 'en')
 */
export function buildConversationSystemPrompt(
  personality: AIPersonality,
  userName?: string,
  language: Language = 'en',
): string {
  const nameContext = userName
    ? `The user's name is ${userName}. You may use their name occasionally to make the conversation feel personal, but don't overuse it.`
    : ''

  const languageInstruction = getLanguageInstruction(language)

  return `${BASE_CONTEXT}

${languageInstruction}

${PERSONALITY_PROMPTS[personality]}

${nameContext}

Start the conversation with a warm, natural greeting and ask how their day is going. 
Make it feel like catching up with a caring friend.`
}

/**
 * Build context from previous conversation turns
 */
export function buildConversationContext(
  turns: Array<{ speaker: 'user' | 'ai'; text: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return turns.map((turn) => ({
    role: turn.speaker === 'user' ? 'user' : 'assistant',
    content: turn.text,
  }))
}

/**
 * Opening greetings the AI can use (varied for freshness)
 * English greetings - kept for backwards compatibility
 */
export const OPENING_GREETINGS = [
  "Hey! How's your day been so far?",
  "Hi there! What's been on your mind today?",
  'Hello! How are you feeling today?',
  'Hey! Anything interesting happen today?',
  "Hi! How's everything going?",
  "Hello! What's the highlight of your day so far?",
  'Hey there! How are you doing today?',
  'Hi! Tell me, how has your day been?',
]

/**
 * Greetings for all supported languages
 * Each language has 8 natural, conversational greetings
 */
export const GREETINGS_BY_LANGUAGE: Record<Language, string[]> = {
  // ==========================================
  // Multilingual Languages (code-switching supported)
  // ==========================================

  // English
  en: OPENING_GREETINGS,

  // Spanish (Español)
  es: [
    '¡Hola! ¿Cómo ha ido tu día hasta ahora?',
    '¡Hola! ¿Qué has tenido en mente hoy?',
    '¡Hola! ¿Cómo te sientes hoy?',
    '¡Hey! ¿Ha pasado algo interesante hoy?',
    '¡Hola! ¿Cómo va todo?',
    '¡Hola! ¿Cuál ha sido lo mejor de tu día hasta ahora?',
    '¡Hola! ¿Cómo estás hoy?',
    '¡Hola! Cuéntame, ¿cómo ha sido tu día?',
  ],

  // French (Français)
  fr: [
    "Salut ! Comment s'est passée ta journée jusqu'ici ?",
    "Coucou ! Qu'est-ce qui t'a traversé l'esprit aujourd'hui ?",
    "Bonjour ! Comment te sens-tu aujourd'hui ?",
    "Hey ! Il s'est passé quelque chose d'intéressant aujourd'hui ?",
    'Salut ! Comment ça va ?',
    "Bonjour ! C'est quoi le meilleur moment de ta journée jusqu'ici ?",
    "Coucou ! Comment vas-tu aujourd'hui ?",
    "Salut ! Raconte-moi, comment s'est passée ta journée ?",
  ],

  // German (Deutsch)
  de: [
    'Hey! Wie war dein Tag bisher?',
    'Hallo! Was ging dir heute so durch den Kopf?',
    'Hallo! Wie fühlst du dich heute?',
    'Hey! Ist heute etwas Interessantes passiert?',
    "Hi! Wie läuft's so?",
    'Hallo! Was war das Highlight deines Tages bisher?',
    "Hey! Wie geht's dir heute?",
    'Hi! Erzähl mal, wie war dein Tag?',
  ],

  // Italian (Italiano)
  it: [
    "Ciao! Com'è andata la tua giornata finora?",
    'Ciao! A cosa hai pensato oggi?',
    'Ciao! Come ti senti oggi?',
    'Ehi! È successo qualcosa di interessante oggi?',
    'Ciao! Come va tutto?',
    'Ciao! Qual è stato il momento migliore della tua giornata finora?',
    'Ciao! Come stai oggi?',
    "Ciao! Raccontami, com'è stata la tua giornata?",
  ],

  // Portuguese (Português)
  pt: [
    'Oi! Como foi o seu dia até agora?',
    'Olá! O que passou pela sua cabeça hoje?',
    'Olá! Como você está se sentindo hoje?',
    'E aí! Aconteceu algo interessante hoje?',
    'Oi! Como está tudo?',
    'Olá! Qual foi o melhor momento do seu dia até agora?',
    'Oi! Como você está hoje?',
    'Olá! Me conta, como foi o seu dia?',
  ],

  // Dutch (Nederlands)
  nl: [
    'Hé! Hoe is je dag tot nu toe geweest?',
    'Hoi! Waar heb je vandaag aan gedacht?',
    'Hallo! Hoe voel je je vandaag?',
    'Hey! Is er iets interessants gebeurd vandaag?',
    'Hoi! Hoe gaat het allemaal?',
    'Hallo! Wat was het hoogtepunt van je dag tot nu toe?',
    'Hé! Hoe gaat het met je vandaag?',
    'Hoi! Vertel, hoe was je dag?',
  ],

  // Japanese (日本語)
  ja: [
    'やあ！今日はどんな一日だった？',
    'こんにちは！今日は何を考えてた？',
    'こんにちは！今日の調子はどう？',
    'ねえ！今日何か面白いことあった？',
    'やあ！調子はどう？',
    'こんにちは！今日のハイライトは何だった？',
    'やあ！今日はどんな感じ？',
    'こんにちは！今日はどんな一日だったか教えて！',
  ],

  // Russian (Русский)
  ru: [
    'Привет! Как прошёл твой день?',
    'Привет! О чём ты сегодня думал?',
    'Привет! Как ты себя чувствуешь сегодня?',
    'Эй! Сегодня произошло что-нибудь интересное?',
    'Привет! Как дела?',
    'Привет! Что было самым ярким моментом твоего дня?',
    'Привет! Как ты сегодня?',
    'Привет! Расскажи, как прошёл твой день?',
  ],

  // Hindi (हिन्दी)
  hi: [
    'नमस्ते! आज का दिन कैसा रहा अब तक?',
    'हाय! आज दिमाग में क्या चल रहा था?',
    'नमस्ते! आज कैसा महसूस कर रहे हो?',
    'अरे! आज कुछ दिलचस्प हुआ?',
    'हाय! सब कैसा चल रहा है?',
    'नमस्ते! आज का सबसे अच्छा पल क्या रहा?',
    'हाय! आज कैसे हो?',
    'नमस्ते! बताओ, आज का दिन कैसा रहा?',
  ],

  // ==========================================
  // Monolingual Languages (single language mode)
  // ==========================================

  // Bulgarian (Български)
  bg: [
    'Здравей! Как мина денят ти досега?',
    'Здрасти! За какво си мислеше днес?',
    'Здравей! Как се чувстваш днес?',
    'Хей! Случи ли се нещо интересно днес?',
    'Здрасти! Как върви всичко?',
    'Здравей! Кое беше най-хубавото от деня ти досега?',
    'Хей! Как си днес?',
    'Здрасти! Разкажи ми, как мина денят ти?',
  ],

  // Catalan (Català)
  ca: [
    'Hola! Com ha anat el teu dia fins ara?',
    'Ei! En què has estat pensant avui?',
    'Hola! Com et sents avui?',
    'Ei! Ha passat alguna cosa interessant avui?',
    'Hola! Com va tot?',
    'Hola! Quin ha estat el millor moment del teu dia fins ara?',
    'Ei! Com estàs avui?',
    "Hola! Explica'm, com ha anat el teu dia?",
  ],

  // Czech (Čeština)
  cs: [
    'Ahoj! Jaký byl tvůj den zatím?',
    'Čau! Na co jsi dnes myslel?',
    'Ahoj! Jak se dnes cítíš?',
    'Hej! Stalo se dnes něco zajímavého?',
    'Čau! Jak to jde?',
    'Ahoj! Co bylo nejlepší na tvém dni zatím?',
    'Hej! Jak se máš dnes?',
    'Čau! Pověz, jaký byl tvůj den?',
  ],

  // Danish (Dansk)
  da: [
    'Hej! Hvordan har din dag været indtil nu?',
    'Hej! Hvad har du tænkt på i dag?',
    'Hej! Hvordan har du det i dag?',
    'Hey! Er der sket noget interessant i dag?',
    'Hej! Hvordan går det?',
    'Hej! Hvad har været højdepunktet på din dag indtil nu?',
    'Hey! Hvordan går det med dig i dag?',
    'Hej! Fortæl mig, hvordan har din dag været?',
  ],

  // Estonian (Eesti)
  et: [
    'Tere! Kuidas su päev siiani on läinud?',
    'Hei! Millele sa täna mõtlesid?',
    'Tere! Kuidas sa end täna tunned?',
    'Hei! Kas täna juhtus midagi huvitavat?',
    'Tere! Kuidas läheb?',
    'Hei! Mis oli su päeva parim hetk siiani?',
    'Tere! Kuidas sul täna läheb?',
    'Hei! Räägi mulle, kuidas su päev on läinud?',
  ],

  // Finnish (Suomi)
  fi: [
    'Hei! Miten päiväsi on mennyt tähän mennessä?',
    'Moi! Mitä olet ajatellut tänään?',
    'Hei! Miltä sinusta tuntuu tänään?',
    'Hei! Onko tänään tapahtunut mitään mielenkiintoista?',
    'Moi! Miten menee?',
    'Hei! Mikä on ollut päiväsi kohokohta tähän mennessä?',
    'Moi! Mitä kuuluu tänään?',
    'Hei! Kerro, miten päiväsi on sujunut?',
  ],

  // Flemish (Vlaams)
  'nl-BE': [
    'Hey! Hoe is uw dag tot nu toe geweest?',
    'Hallo! Waar hebt ge vandaag aan gedacht?',
    'Hey! Hoe voelt ge u vandaag?',
    'Hé! Is er iets interessants gebeurd vandaag?',
    'Hallo! Hoe gaat het allemaal?',
    'Hey! Wat was het hoogtepunt van uw dag tot nu toe?',
    'Hé! Hoe gaat het met u vandaag?',
    'Hallo! Vertel, hoe was uw dag?',
  ],

  // Greek (Ελληνικά)
  el: [
    'Γεια! Πώς ήταν η μέρα σου μέχρι τώρα;',
    'Γεια σου! Τι σκεφτόσουν σήμερα;',
    'Γεια! Πώς νιώθεις σήμερα;',
    'Χέι! Έγινε κάτι ενδιαφέρον σήμερα;',
    'Γεια! Πώς πάνε όλα;',
    'Γεια σου! Ποιο ήταν το καλύτερο σημείο της μέρας σου;',
    'Χέι! Πώς είσαι σήμερα;',
    'Γεια! Πες μου, πώς πήγε η μέρα σου;',
  ],

  // Hungarian (Magyar)
  hu: [
    'Szia! Milyen volt a napod eddig?',
    'Helló! Min gondolkodtál ma?',
    'Szia! Hogy érzed magad ma?',
    'Hé! Történt valami érdekes ma?',
    'Helló! Hogy megy minden?',
    'Szia! Mi volt a napod legjobb része eddig?',
    'Hé! Hogy vagy ma?',
    'Helló! Mesélj, milyen volt a napod?',
  ],

  // Indonesian (Bahasa Indonesia)
  id: [
    'Hai! Bagaimana harimu sejauh ini?',
    'Halo! Apa yang kamu pikirkan hari ini?',
    'Hai! Bagaimana perasaanmu hari ini?',
    'Hei! Ada yang menarik terjadi hari ini?',
    'Halo! Bagaimana kabarmu?',
    'Hai! Apa momen terbaik harimu sejauh ini?',
    'Hei! Apa kabar hari ini?',
    'Halo! Ceritakan, bagaimana harimu?',
  ],

  // Korean (한국어)
  ko: [
    '안녕! 오늘 하루 어땠어?',
    '안녕! 오늘 무슨 생각했어?',
    '안녕! 오늘 기분이 어때?',
    '야! 오늘 재미있는 일 있었어?',
    '안녕! 어떻게 지내?',
    '안녕! 오늘 하루 중 제일 좋았던 게 뭐야?',
    '야! 오늘 어때?',
    '안녕! 오늘 하루 어땠는지 말해줘!',
  ],

  // Latvian (Latviešu)
  lv: [
    'Sveiki! Kā tev šodien ir gājis līdz šim?',
    'Čau! Par ko tu šodien domāji?',
    'Sveiki! Kā tu šodien jūties?',
    'Hei! Vai šodien notika kaut kas interesants?',
    'Čau! Kā iet?',
    'Sveiki! Kas bija labākais tavā dienā līdz šim?',
    'Hei! Kā tev šodien klājas?',
    'Čau! Pastāsti, kā pagāja tava diena?',
  ],

  // Lithuanian (Lietuvių)
  lt: [
    'Sveiki! Kaip tavo diena iki šiol?',
    'Labas! Apie ką šiandien galvojai?',
    'Sveiki! Kaip jautiesi šiandien?',
    'Ei! Ar šiandien nutiko kas nors įdomaus?',
    'Labas! Kaip sekasi?',
    'Sveiki! Kas buvo geriausia tavo dienoje iki šiol?',
    'Ei! Kaip tau šiandien sekasi?',
    'Labas! Papasakok, kaip praėjo tavo diena?',
  ],

  // Malay (Bahasa Melayu)
  ms: [
    'Hai! Macam mana hari kamu setakat ini?',
    'Hello! Apa yang kamu fikirkan hari ini?',
    'Hai! Macam mana perasaan kamu hari ini?',
    'Hei! Ada apa-apa yang menarik berlaku hari ini?',
    'Hello! Apa khabar?',
    'Hai! Apa momen terbaik hari kamu setakat ini?',
    'Hei! Apa khabar hari ini?',
    'Hello! Ceritakan, macam mana hari kamu?',
  ],

  // Norwegian (Norsk)
  no: [
    'Hei! Hvordan har dagen din vært så langt?',
    'Hei! Hva har du tenkt på i dag?',
    'Hei! Hvordan føler du deg i dag?',
    'Hey! Har det skjedd noe interessant i dag?',
    'Hei! Hvordan går det?',
    'Hei! Hva har vært høydepunktet i dagen din så langt?',
    'Hey! Hvordan har du det i dag?',
    'Hei! Fortell meg, hvordan har dagen din vært?',
  ],

  // Polish (Polski)
  pl: [
    'Cześć! Jak minął ci dzień do tej pory?',
    'Hej! O czym dzisiaj myślałeś?',
    'Cześć! Jak się dzisiaj czujesz?',
    'Hej! Czy dzisiaj wydarzyło się coś ciekawego?',
    'Cześć! Jak leci?',
    'Hej! Co było najlepsze w twoim dniu do tej pory?',
    'Cześć! Jak się masz dzisiaj?',
    'Hej! Opowiedz, jak minął ci dzień?',
  ],

  // Romanian (Română)
  ro: [
    'Salut! Cum a fost ziua ta până acum?',
    'Bună! La ce te-ai gândit azi?',
    'Salut! Cum te simți azi?',
    'Hei! S-a întâmplat ceva interesant azi?',
    'Bună! Cum merge totul?',
    'Salut! Care a fost cel mai bun moment din ziua ta până acum?',
    'Hei! Ce mai faci azi?',
    'Bună! Povestește-mi, cum a fost ziua ta?',
  ],

  // Slovak (Slovenčina)
  sk: [
    'Ahoj! Aký bol tvoj deň doteraz?',
    'Čau! Na čo si dnes myslel?',
    'Ahoj! Ako sa dnes cítiš?',
    'Hej! Stalo sa dnes niečo zaujímavé?',
    'Čau! Ako to ide?',
    'Ahoj! Čo bolo najlepšie na tvojom dni doteraz?',
    'Hej! Ako sa máš dnes?',
    'Čau! Povedz, aký bol tvoj deň?',
  ],

  // Swedish (Svenska)
  sv: [
    'Hej! Hur har din dag varit hittills?',
    'Tjena! Vad har du tänkt på idag?',
    'Hej! Hur mår du idag?',
    'Hallå! Har det hänt något intressant idag?',
    'Tjena! Hur går det?',
    'Hej! Vad har varit höjdpunkten på din dag hittills?',
    'Hallå! Hur är det med dig idag?',
    'Tjena! Berätta, hur har din dag varit?',
  ],

  // Turkish (Türkçe)
  tr: [
    'Selam! Bugün günün nasıl geçti şimdiye kadar?',
    'Merhaba! Bugün aklından neler geçti?',
    'Selam! Bugün kendini nasıl hissediyorsun?',
    'Hey! Bugün ilginç bir şey oldu mu?',
    'Merhaba! Nasıl gidiyor?',
    'Selam! Bugünün en güzel anı ne oldu şimdiye kadar?',
    'Hey! Bugün nasılsın?',
    'Merhaba! Anlat bakalım, günün nasıl geçti?',
  ],

  // Ukrainian (Українська)
  uk: [
    'Привіт! Як пройшов твій день досі?',
    'Привіт! Про що ти сьогодні думав?',
    'Привіт! Як ти себе почуваєш сьогодні?',
    'Гей! Сьогодні сталося щось цікаве?',
    'Привіт! Як справи?',
    'Привіт! Що було найкращим у твоєму дні досі?',
    'Гей! Як ти сьогодні?',
    'Привіт! Розкажи, як пройшов твій день?',
  ],

  // Vietnamese (Tiếng Việt)
  vi: [
    'Chào! Ngày của bạn thế nào rồi?',
    'Xin chào! Hôm nay bạn đang nghĩ gì?',
    'Chào! Hôm nay bạn cảm thấy thế nào?',
    'Này! Hôm nay có chuyện gì thú vị không?',
    'Xin chào! Mọi thứ thế nào rồi?',
    'Chào! Điều tuyệt nhất trong ngày của bạn là gì?',
    'Này! Hôm nay bạn khỏe không?',
    'Xin chào! Kể cho mình nghe, ngày của bạn thế nào?',
  ],

  // Chinese Simplified (简体中文) - requires Nova-2 model
  zh: [
    '嗨！今天过得怎么样？',
    '你好！今天在想什么呢？',
    '嗨！今天感觉怎么样？',
    '嘿！今天有什么有趣的事吗？',
    '你好！一切都好吗？',
    '嗨！今天最开心的事是什么？',
    '嘿！今天怎么样？',
    '你好！跟我说说，今天过得如何？',
  ],

  // Chinese Traditional (繁體中文) - requires Nova-2 model
  'zh-TW': [
    '嗨！今天過得怎麼樣？',
    '你好！今天在想什麼呢？',
    '嗨！今天感覺怎麼樣？',
    '嘿！今天有什麼有趣的事嗎？',
    '你好！一切都好嗎？',
    '嗨！今天最開心的事是什麼？',
    '嘿！今天怎麼樣？',
    '你好！跟我說說，今天過得如何？',
  ],
}

/**
 * Get a random opening greeting in the specified language
 */
export function getRandomGreeting(language: Language = 'en'): string {
  const greetings = GREETINGS_BY_LANGUAGE[language] ?? GREETINGS_BY_LANGUAGE.en
  const index = Math.floor(Math.random() * greetings.length)
  return greetings[index]!
}

/**
 * Build prompt for generating the AI's first message
 */
export function buildFirstMessagePrompt(
  personality: AIPersonality,
  userName?: string,
  language: Language = 'en',
): string {
  return buildConversationSystemPrompt(personality, userName, language)
}
