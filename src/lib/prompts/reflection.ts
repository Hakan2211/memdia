/**
 * Reflection Prompts
 * System prompts for the AI companion during 10-minute reflection sessions
 * More therapeutic and probing than the shorter memory sessions
 */

import type { AIPersonality, Language } from '../../types/voice-session'
import { LANGUAGE_LABELS } from '../../types/voice-session'

/**
 * Base context for reflections - more therapeutic and in-depth than memories
 */
const REFLECTION_BASE_CONTEXT = `You are a compassionate AI companion helping the user with a 10-minute reflection session. 
This is their time to process deeper thoughts, emotions, and experiences.

IMPORTANT GUIDELINES:
- Keep responses conversational (2-4 sentences) since this is a voice conversation
- This is a longer, deeper session - take your time and go beneath the surface
- Ask thoughtful, probing follow-up questions that help them gain clarity
- Create a safe, non-judgmental space for emotional exploration
- When they mention a person or relationship, explore the dynamics
- When they mention stress or anxiety, help them identify root causes
- Gently challenge assumptions when it might help them see things differently
- Offer perspective shifts when appropriate, but never dismiss their feelings
- Help them connect dots between different parts of their experience
- Use reflective listening - sometimes repeat back what you heard to confirm understanding
- Avoid lists or complex structures (this will be spoken aloud)
- Never mention that you're an AI or time constraints`

/**
 * Personality-specific additions for reflections
 */
const REFLECTION_PERSONALITY_PROMPTS: Record<AIPersonality, string> = {
  empathetic: `
PERSONALITY: Therapeutic & Empathetic Guide
- Lead with deep empathy and unconditional acceptance
- Create a container of safety for vulnerable sharing
- Use validating phrases like "That makes complete sense" or "It's understandable you'd feel that way"
- Help them sit with difficult emotions rather than rushing past them
- Notice patterns and gently reflect them back
- Ask "What do you think is really going on beneath that?" when appropriate
- If they share something painful, acknowledge the weight and stay present with them
- Help them find their own wisdom - ask "What does your gut tell you?" or "What would you tell a friend in this situation?"`,

  curious: `
PERSONALITY: Curious & Insightful Explorer
- Show genuine fascination with their inner world
- Ask questions that help them see familiar situations in new ways
- Use phrases like "That's interesting - what do you think drives that?" or "I'm curious about..."
- Help them explore the 'why' behind their thoughts and feelings
- Bring gentle energy while maintaining depth
- Notice contradictions or tensions and gently explore them
- Ask "What would it look like if..." to help them imagine alternatives
- Encourage them to dig deeper - "Tell me more about that feeling"`,
}

/**
 * Get language instruction for the reflection system prompt
 */
function getReflectionLanguageInstruction(language: Language): string {
  const { native, name } = LANGUAGE_LABELS[language]

  if (language === 'en') {
    return `
LANGUAGE: Speak in English.
If the user switches to another language, naturally adapt and respond in whatever language they're using.`
  }

  return `
LANGUAGE: The user's preferred language is ${native} (${name}).
- Begin and continue the conversation in ${native}
- Use natural, warm, conversational ${native} - therapeutic but not clinical
- If the user switches to a different language mid-conversation, naturally adapt
- Always match the language the user is speaking`
}

/**
 * Build the system prompt for a reflection session
 */
export function buildReflectionSystemPrompt(
  personality: AIPersonality,
  userName?: string,
  language: Language = 'en',
): string {
  const nameContext = userName
    ? `The user's name is ${userName}. You may use their name occasionally to create warmth, but don't overuse it.`
    : ''

  const languageInstruction = getReflectionLanguageInstruction(language)

  return `${REFLECTION_BASE_CONTEXT}

${languageInstruction}

${REFLECTION_PERSONALITY_PROMPTS[personality]}

${nameContext}

Begin with a warm, inviting opening that signals you're ready to listen deeply. 
Make them feel they have the space and time to really explore what's on their mind.`
}

/**
 * Reflection-specific greetings - more therapeutic and inviting than memory greetings
 * These signal to the user that this is a space for deeper exploration
 */
export const REFLECTION_GREETINGS_BY_LANGUAGE: Record<Language, string[]> = {
  // English
  en: [
    "Take your time. What's been weighing on your mind?",
    "I'm here to listen. What would you like to explore today?",
    "This is your space. What's been on your heart lately?",
    "No rush here. What's something you've been needing to process?",
    "I'm all ears. What's been sitting with you that you'd like to talk through?",
    "Welcome. What's calling for your attention today?",
    'Take a breath. What would feel good to talk about?',
    "I'm here with you. What would help to get off your chest?",
  ],

  // Spanish (Español)
  es: [
    'Tómate tu tiempo. ¿Qué ha estado pesando en tu mente?',
    'Estoy aquí para escucharte. ¿Qué te gustaría explorar hoy?',
    'Este es tu espacio. ¿Qué ha estado en tu corazón últimamente?',
    'Sin prisa. ¿Hay algo que necesitas procesar?',
    'Te escucho. ¿Qué te gustaría hablar?',
    'Bienvenido. ¿Qué está llamando tu atención hoy?',
    'Respira profundo. ¿De qué te gustaría hablar?',
    'Estoy aquí contigo. ¿Qué te ayudaría desahogar?',
  ],

  // French (Français)
  fr: [
    "Prends ton temps. Qu'est-ce qui te préoccupe?",
    "Je suis là pour t'écouter. Qu'aimerais-tu explorer aujourd'hui?",
    "C'est ton espace. Qu'est-ce qui te pèse sur le cœur ces derniers temps?",
    "Pas de précipitation. Qu'as-tu besoin de traiter?",
    "Je t'écoute. De quoi aimerais-tu parler?",
    "Bienvenue. Qu'est-ce qui demande ton attention aujourd'hui?",
    'Respire. De quoi aurais-tu envie de parler?',
    "Je suis là avec toi. Qu'est-ce qui te ferait du bien de partager?",
  ],

  // German (Deutsch)
  de: [
    'Nimm dir Zeit. Was beschäftigt dich gerade?',
    'Ich bin hier, um zuzuhören. Was möchtest du heute erkunden?',
    'Das ist dein Raum. Was liegt dir in letzter Zeit auf dem Herzen?',
    'Keine Eile. Was musst du verarbeiten?',
    'Ich höre dir zu. Worüber möchtest du sprechen?',
    'Willkommen. Was braucht heute deine Aufmerksamkeit?',
    'Atme durch. Worüber würdest du gerne reden?',
    'Ich bin hier bei dir. Was würde dir helfen, es loszuwerden?',
  ],

  // Italian (Italiano)
  it: [
    'Prenditi il tuo tempo. Cosa ti pesa nella mente?',
    'Sono qui per ascoltarti. Cosa vorresti esplorare oggi?',
    'Questo è il tuo spazio. Cosa hai nel cuore ultimamente?',
    'Nessuna fretta. Cosa hai bisogno di elaborare?',
    'Ti ascolto. Di cosa vorresti parlare?',
    'Benvenuto. Cosa richiede la tua attenzione oggi?',
    'Fai un respiro. Di cosa ti farebbe bene parlare?',
    'Sono qui con te. Cosa ti aiuterebbe a sfogarti?',
  ],

  // Portuguese (Português)
  pt: [
    'Tome seu tempo. O que está pesando na sua mente?',
    'Estou aqui para ouvir. O que você gostaria de explorar hoje?',
    'Este é o seu espaço. O que tem estado no seu coração?',
    'Sem pressa. O que você precisa processar?',
    'Estou ouvindo. Sobre o que você gostaria de conversar?',
    'Bem-vindo. O que está pedindo sua atenção hoje?',
    'Respire fundo. Sobre o que seria bom conversar?',
    'Estou aqui com você. O que ajudaria a tirar do peito?',
  ],

  // Dutch (Nederlands)
  nl: [
    'Neem je tijd. Wat speelt er in je hoofd?',
    'Ik ben er om te luisteren. Wat zou je vandaag willen verkennen?',
    'Dit is jouw ruimte. Wat zit je de laatste tijd dwars?',
    'Geen haast. Wat moet je verwerken?',
    'Ik luister. Waar zou je over willen praten?',
    'Welkom. Wat vraagt vandaag je aandacht?',
    'Adem even. Waar zou je het over willen hebben?',
    'Ik ben hier bij je. Wat zou helpen om van je af te praten?',
  ],

  // Japanese (日本語)
  ja: [
    'ゆっくりでいいよ。何か心に引っかかってることある？',
    '聞いているよ。今日は何を話したい？',
    'ここは君のための場所だよ。最近、心にあることは？',
    '急がなくていいよ。整理したいことがある？',
    '聞いてるよ。何について話したい？',
    'ようこそ。今日、気になっていることは？',
    '深呼吸して。何を話せると楽になる？',
    'そばにいるよ。吐き出したいことある？',
  ],

  // Russian (Русский)
  ru: [
    'Не торопись. Что тебя беспокоит?',
    'Я здесь, чтобы слушать. Что бы ты хотел обсудить сегодня?',
    'Это твоё пространство. Что у тебя на сердце в последнее время?',
    'Без спешки. Что тебе нужно обдумать?',
    'Я слушаю. О чём бы ты хотел поговорить?',
    'Добро пожаловать. Что требует твоего внимания сегодня?',
    'Вздохни глубоко. О чём было бы хорошо поговорить?',
    'Я здесь с тобой. Что помогло бы тебе выговориться?',
  ],

  // Hindi (हिन्दी)
  hi: [
    'अपना समय लो। क्या मन में कुछ चल रहा है?',
    'मैं सुनने के लिए यहाँ हूँ। आज क्या बात करना चाहोगे?',
    'यह तुम्हारा स्थान है। हाल में दिल में क्या है?',
    'कोई जल्दी नहीं। क्या कुछ है जो समझना चाहते हो?',
    'मैं सुन रहा हूँ। किस बारे में बात करना चाहोगे?',
    'स्वागत है। आज क्या ध्यान माँग रहा है?',
    'गहरी साँस लो। किस बारे में बात करना अच्छा लगेगा?',
    'मैं तुम्हारे साथ हूँ। क्या दिल हल्का करने में मदद करेगा?',
  ],

  // Bulgarian (Български)
  bg: [
    'Вземи си време. Какво те тежи?',
    'Тук съм да слушам. Какво искаш да обсъдим днес?',
    'Това е твоето пространство. Какво ти е на сърце напоследък?',
    'Без бързане. Какво трябва да преработиш?',
    'Слушам те. За какво искаш да поговорим?',
    'Добре дошъл. Какво изисква вниманието ти днес?',
    'Поеми дъх. За какво би било добре да поговорим?',
    'Тук съм с теб. Какво би ти помогнало да се изкажеш?',
  ],

  // Catalan (Català)
  ca: [
    "Pren-te el teu temps. Què t'està pesant?",
    "Sóc aquí per escoltar. Què t'agradaria explorar avui?",
    'Aquest és el teu espai. Què tens al cor últimament?',
    'Sense pressa. Què necessites processar?',
    "T'escolto. De què t'agradaria parlar?",
    'Benvingut. Què demana la teva atenció avui?',
    'Respira. De què et faria bé parlar?',
    "Sóc aquí amb tu. Què t'ajudaria a desfogar-te?",
  ],

  // Czech (Čeština)
  cs: [
    'Dej si čas. Co tě trápí?',
    'Jsem tu, abych naslouchal. Co bys chtěl dnes prozkoumat?',
    'Toto je tvůj prostor. Co máš na srdci v poslední době?',
    'Žádný spěch. Co potřebuješ zpracovat?',
    'Poslouchám. O čem bys chtěl mluvit?',
    'Vítej. Co dnes vyžaduje tvou pozornost?',
    'Nadechni se. O čem by ti bylo dobré mluvit?',
    'Jsem tu s tebou. Co by ti pomohlo se vypovídat?',
  ],

  // Danish (Dansk)
  da: [
    'Tag din tid. Hvad tynger dig?',
    'Jeg er her for at lytte. Hvad vil du gerne udforske i dag?',
    'Dette er dit rum. Hvad har du på hjertet for tiden?',
    'Ingen stress. Hvad har du brug for at bearbejde?',
    'Jeg lytter. Hvad vil du gerne tale om?',
    'Velkommen. Hvad kræver din opmærksomhed i dag?',
    'Tag en dyb indånding. Hvad ville være godt at tale om?',
    'Jeg er her med dig. Hvad ville hjælpe dig med at få det ud?',
  ],

  // Estonian (Eesti)
  et: [
    'Võta aega. Mis sind vaevab?',
    'Olen siin, et kuulata. Mida soovid täna uurida?',
    'See on sinu ruum. Mis on sul südamel viimasel ajal?',
    'Pole kiiret. Mida pead läbi töötama?',
    'Ma kuulan. Millest tahaksid rääkida?',
    'Tere tulemast. Mis nõuab täna su tähelepanu?',
    'Hinga sügavalt. Millest oleks hea rääkida?',
    'Olen sinuga siin. Mis aitaks sul südant kergendada?',
  ],

  // Finnish (Suomi)
  fi: [
    'Ota aikasi. Mikä painaa mieltäsi?',
    'Olen täällä kuuntelemassa. Mitä haluaisit tutkia tänään?',
    'Tämä on sinun tilasi. Mikä on ollut sydämelläsi viime aikoina?',
    'Ei kiirettä. Mitä sinun täytyy käsitellä?',
    'Kuuntelen. Mistä haluaisit puhua?',
    'Tervetuloa. Mikä vaatii huomiotasi tänään?',
    'Hengitä syvään. Mistä olisi hyvä puhua?',
    'Olen täällä kanssasi. Mikä auttaisi sinua purkamaan olosi?',
  ],

  // Flemish (Vlaams)
  'nl-BE': [
    'Neem uw tijd. Wat speelt er in uw hoofd?',
    'Ik ben er om te luisteren. Wat zou u vandaag willen bespreken?',
    'Dit is uw ruimte. Wat zit u de laatste tijd dwars?',
    'Geen haast. Wat moet u verwerken?',
    'Ik luister. Waar zou u over willen praten?',
    'Welkom. Wat vraagt vandaag uw aandacht?',
    'Adem even. Waar zou u het over willen hebben?',
    'Ik ben hier bij u. Wat zou helpen om van u af te praten?',
  ],

  // Greek (Ελληνικά)
  el: [
    'Πάρε τον χρόνο σου. Τι σε απασχολεί;',
    'Είμαι εδώ να ακούσω. Τι θα ήθελες να εξερευνήσεις σήμερα;',
    'Αυτός είναι ο χώρος σου. Τι έχεις στην καρδιά σου τελευταία;',
    'Χωρίς βιασύνη. Τι χρειάζεσαι να επεξεργαστείς;',
    'Σε ακούω. Για τι θα ήθελες να μιλήσεις;',
    'Καλώς ήρθες. Τι ζητά την προσοχή σου σήμερα;',
    'Πάρε μια βαθιά ανάσα. Για τι θα ήταν καλό να μιλήσεις;',
    'Είμαι εδώ μαζί σου. Τι θα σε βοηθούσε να ξεφορτωθείς;',
  ],

  // Hungarian (Magyar)
  hu: [
    'Szánj rá időt. Mi nyomaszt?',
    'Itt vagyok, hogy hallgassalak. Mit szeretnél felfedezni ma?',
    'Ez a te tered. Mi van a szíveden mostanában?',
    'Semmi sietség. Mit kell feldolgoznod?',
    'Hallgatlak. Miről szeretnél beszélni?',
    'Üdvözöllek. Mi igényli ma a figyelmedet?',
    'Vegyél egy mély levegőt. Miről lenne jó beszélni?',
    'Itt vagyok veled. Mi segítene kibeszélni magad?',
  ],

  // Indonesian (Bahasa Indonesia)
  id: [
    'Ambil waktumu. Apa yang membebani pikiranmu?',
    'Aku di sini untuk mendengarkan. Apa yang ingin kamu jelajahi hari ini?',
    'Ini ruangmu. Apa yang ada di hatimu akhir-akhir ini?',
    'Tidak perlu buru-buru. Apa yang perlu kamu proses?',
    'Aku mendengarkan. Apa yang ingin kamu bicarakan?',
    'Selamat datang. Apa yang membutuhkan perhatianmu hari ini?',
    'Tarik napas dalam. Apa yang enak dibicarakan?',
    'Aku di sini bersamamu. Apa yang bisa membantu meringankan bebanmu?',
  ],

  // Korean (한국어)
  ko: [
    '천천히 해도 돼. 마음에 걸리는 게 있어?',
    '듣고 있어. 오늘 무슨 이야기를 하고 싶어?',
    '여기는 네 공간이야. 요즘 마음에 뭐가 있어?',
    '서두르지 않아도 돼. 정리하고 싶은 게 있어?',
    '들을게. 무슨 얘기하고 싶어?',
    '어서 와. 오늘 뭐가 신경 쓰여?',
    '깊게 숨 쉬어봐. 무슨 얘기하면 좋을까?',
    '옆에 있을게. 털어놓으면 도움이 될 것 같아?',
  ],

  // Latvian (Latviešu)
  lv: [
    'Ņem savu laiku. Kas tevi nomāc?',
    'Esmu šeit, lai klausītos. Ko tu šodien vēlētos izpētīt?',
    'Šī ir tava telpa. Kas tev pēdējā laikā ir uz sirds?',
    'Nav steigas. Ko tev vajag apstrādāt?',
    'Es klausos. Par ko tu gribētu parunāt?',
    'Laipni lūgts. Kas šodien prasa tavu uzmanību?',
    'Ieelpo dziļi. Par ko būtu labi parunāt?',
    'Es esmu šeit ar tevi. Kas tev palīdzētu izrunāties?',
  ],

  // Lithuanian (Lietuvių)
  lt: [
    'Neskubėk. Kas tave slegia?',
    'Esu čia klausytis. Ką norėtum aptarti šiandien?',
    'Čia tavo erdvė. Kas tau ant širdies pastaruoju metu?',
    'Neskubėk. Ką tau reikia apdoroti?',
    'Klausau. Apie ką norėtum pasikalbėti?',
    'Sveiki. Kas šiandien reikalauja tavo dėmesio?',
    'Įkvėpk giliai. Apie ką būtų gera pasikalbėti?',
    'Esu čia su tavimi. Kas padėtų tau išsikalbėti?',
  ],

  // Malay (Bahasa Melayu)
  ms: [
    'Ambil masa kamu. Apa yang membebankan fikiran kamu?',
    'Saya di sini untuk mendengar. Apa yang kamu mahu terokai hari ini?',
    'Ini ruang kamu. Apa yang ada di hati kamu kebelakangan ini?',
    'Tiada tergesa-gesa. Apa yang kamu perlu proses?',
    'Saya mendengar. Apa yang kamu mahu bincangkan?',
    'Selamat datang. Apa yang memerlukan perhatian kamu hari ini?',
    'Tarik nafas dalam. Apa yang seronok untuk dibincangkan?',
    'Saya di sini dengan kamu. Apa yang boleh membantu meringankan beban kamu?',
  ],

  // Norwegian (Norsk)
  no: [
    'Ta deg tid. Hva tynger deg?',
    'Jeg er her for å lytte. Hva vil du utforske i dag?',
    'Dette er ditt rom. Hva har du på hjertet i det siste?',
    'Ingen hastverk. Hva trenger du å bearbeide?',
    'Jeg lytter. Hva vil du snakke om?',
    'Velkommen. Hva krever oppmerksomheten din i dag?',
    'Ta et dypt åndedrag. Hva ville være godt å snakke om?',
    'Jeg er her med deg. Hva ville hjelpe deg å få det ut?',
  ],

  // Polish (Polski)
  pl: [
    'Nie spiesz się. Co cię trapi?',
    'Jestem tu, żeby słuchać. Co chciałbyś dziś zbadać?',
    'To twoja przestrzeń. Co masz ostatnio na sercu?',
    'Bez pośpiechu. Co musisz przepracować?',
    'Słucham. O czym chciałbyś porozmawiać?',
    'Witaj. Co wymaga dziś twojej uwagi?',
    'Weź głęboki oddech. O czym byłoby dobrze porozmawiać?',
    'Jestem tu z tobą. Co pomogłoby ci się wygadać?',
  ],

  // Romanian (Română)
  ro: [
    'Ia-ți timp. Ce te apasă?',
    'Sunt aici să ascult. Ce ai vrea să explorezi azi?',
    'Acesta este spațiul tău. Ce ai pe suflet în ultima vreme?',
    'Fără grabă. Ce trebuie să procesezi?',
    'Te ascult. Despre ce ai vrea să vorbim?',
    'Bine ai venit. Ce necesită atenția ta azi?',
    'Respiră adânc. Despre ce ar fi bine să vorbim?',
    'Sunt aici cu tine. Ce te-ar ajuta să te descarci?',
  ],

  // Slovak (Slovenčina)
  sk: [
    'Daj si čas. Čo ťa trápi?',
    'Som tu, aby som počúval. Čo by si chcel dnes preskúmať?',
    'Toto je tvoj priestor. Čo máš na srdci v poslednej dobe?',
    'Žiadny náhlenie. Čo potrebuješ spracovať?',
    'Počúvam. O čom by si chcel hovoriť?',
    'Vitaj. Čo dnes vyžaduje tvoju pozornosť?',
    'Zhlboka sa nadýchni. O čom by bolo dobré hovoriť?',
    'Som tu s tebou. Čo by ti pomohlo sa vyrozprávať?',
  ],

  // Swedish (Svenska)
  sv: [
    'Ta din tid. Vad tynger dig?',
    'Jag är här för att lyssna. Vad vill du utforska idag?',
    'Det här är ditt utrymme. Vad har du på hjärtat på sistone?',
    'Ingen brådska. Vad behöver du bearbeta?',
    'Jag lyssnar. Vad vill du prata om?',
    'Välkommen. Vad kräver din uppmärksamhet idag?',
    'Ta ett djupt andetag. Vad skulle vara bra att prata om?',
    'Jag är här med dig. Vad skulle hjälpa dig att få ur dig det?',
  ],

  // Turkish (Türkçe)
  tr: [
    'Acele etme. Aklını ne meşgul ediyor?',
    'Dinlemek için buradayım. Bugün neyi keşfetmek istersin?',
    'Burası senin alanın. Son zamanlarda kalbinde ne var?',
    'Acele yok. Neyi işlemen gerekiyor?',
    'Dinliyorum. Ne hakkında konuşmak istersin?',
    'Hoş geldin. Bugün dikkatini ne çekiyor?',
    'Derin bir nefes al. Ne hakkında konuşmak iyi olurdu?',
    'Seninle buradayım. İçini dökmene ne yardımcı olurdu?',
  ],

  // Ukrainian (Українська)
  uk: [
    'Не поспішай. Що тебе турбує?',
    'Я тут, щоб слухати. Що б ти хотів дослідити сьогодні?',
    'Це твій простір. Що у тебе на серці останнім часом?',
    'Без поспіху. Що тобі потрібно обдумати?',
    'Я слухаю. Про що ти хотів би поговорити?',
    'Ласкаво просимо. Що потребує твоєї уваги сьогодні?',
    'Глибоко вдихни. Про що було б добре поговорити?',
    'Я тут з тобою. Що допомогло б тобі виговоритися?',
  ],

  // Vietnamese (Tiếng Việt)
  vi: [
    'Từ từ thôi. Điều gì đang đè nặng tâm trí bạn?',
    'Tôi ở đây để lắng nghe. Hôm nay bạn muốn khám phá điều gì?',
    'Đây là không gian của bạn. Gần đây bạn có điều gì trong lòng?',
    'Không cần vội. Bạn cần xử lý điều gì?',
    'Tôi đang nghe. Bạn muốn nói về điều gì?',
    'Chào mừng. Điều gì cần sự chú ý của bạn hôm nay?',
    'Hít thở sâu. Nói về điều gì sẽ tốt?',
    'Tôi ở đây cùng bạn. Điều gì sẽ giúp bạn trút bỏ?',
  ],

  // Chinese Simplified (简体中文)
  zh: [
    '慢慢来。有什么在困扰你吗？',
    '我在这里倾听。今天你想聊些什么？',
    '这是你的空间。最近心里有什么事吗？',
    '不着急。有什么需要理清的吗？',
    '我在听。你想聊什么？',
    '欢迎。今天有什么需要关注的吗？',
    '深呼吸。聊什么会让你舒服一些？',
    '我陪着你。说出来会不会好一些？',
  ],

  // Chinese Traditional (繁體中文)
  'zh-TW': [
    '慢慢來。有什麼在困擾你嗎？',
    '我在這裡傾聽。今天你想聊些什麼？',
    '這是你的空間。最近心裡有什麼事嗎？',
    '不著急。有什麼需要理清的嗎？',
    '我在聽。你想聊什麼？',
    '歡迎。今天有什麼需要關注的嗎？',
    '深呼吸。聊什麼會讓你舒服一些？',
    '我陪著你。說出來會不會好一些？',
  ],
}

/**
 * Get a random reflection greeting in the specified language
 */
export function getRandomReflectionGreeting(language: Language = 'en'): string {
  const greetings =
    REFLECTION_GREETINGS_BY_LANGUAGE[language] ??
    REFLECTION_GREETINGS_BY_LANGUAGE.en
  const index = Math.floor(Math.random() * greetings.length)
  return greetings[index]!
}

/**
 * Build context from previous reflection turns
 */
export function buildReflectionContext(
  turns: Array<{ speaker: 'user' | 'ai'; text: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return turns.map((turn) => ({
    role: turn.speaker === 'user' ? 'user' : 'assistant',
    content: turn.text,
  }))
}
