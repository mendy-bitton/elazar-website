/* The site as built: the default texts, contact details and event types.
   Plain data, shared by the site (content.jsx: what Elazar saves in /admin overrides it)
   and by the build (seo.js: the page text written into each HTML file for search and AI bots). */
export const DEFAULT_TEXTS = {
  heroTitle1: 'עם כל הלב,',
  heroTitle2: 'לשמחה שלכם',
  heroLead1: 'אני אלעזר ביטון, זמר חתונות ואירועים בסגנון חב״די וחסידי. אני מאמין שכל שמחה צריכה נשמה, ולכן אני מגיע לכל אירוע עם כל הלב.',
  heroLead2: 'מניגוני הקבלת פנים והחופה המרגשים ועד ריקודים סוערים שלא נגמרים, אני בונה את הערב יחד אתכם, לפי הקהל, האווירה והרגע.',
  momentsTitle: 'רגעים מהשמחות',
  musicTitle: 'המוזיקה שלי',
  musicSub: 'בחרו שיר מהמדף, ולחצו על העטיפה כדי להאזין.',
  reelTitle: 'מהבמה',
  reelSub: 'השמחה, בלי פילטרים.',
  ctaLine1: 'חוגגים שמחה?',
  ctaLine2: 'אירוע?',
  ctaLine3: 'בואו נדבר.'
};

export const DEFAULT_CONTACT = {
  phone: '052.810.8100',
  whatsapp: '052.810.8100',
  whatsappText: 'שלום אלעזר, אשמח לקבל הצעת מחיר לאירוע.\nתאריך: \nמקום: ',
  instagram: 'elazar_bitton_official'
};

// the events strip on the home page ("o": outlined)
export const EVENT_TYPES = [['אירועים', ''], ['בר מצוות', 'o'], ['חתונות', ''], ['התוועדויות', 'o'], ['שמחות בית השואבה', ''], ['שבע ברכות', 'o']];
