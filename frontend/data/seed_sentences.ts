/**
 * Task 3: 10 Realistic Report Sentences for Challenge Compiler & Deduplication Testing
 * 
 * Distribution:
 * - 5 Hindi (Roman & Devanagari script)
 * - 5 English
 * - 2 Near-duplicates of the Gumla Lightning scenario (demonstrating clustering / semantic dedup)
 */

export interface TestSentence {
  id: string;
  lang: 'Hindi' | 'English';
  is_duplicate_target?: string;
  district: string;
  text: string;
  devanagari_transcription?: string;
  expected_category: string;
  expected_severity: number;
  expected_priority_band: 'critical' | 'high' | 'moderate' | 'long-term';
  expected_people_est: number;
}

export const SEED_REPORT_SENTENCES: TestSentence[] = [
  // ─── 5 HINDI SENTENCES (INCLUDING 2 LIGHTNING NEAR-DUPLICATES) ───
  {
    id: 'SENT-HI-01',
    lang: 'Hindi',
    district: 'Gumla',
    text: 'Khet me dhaan ropte samay achanak bijli girne se do kisan mar gaye, yahan koi shelter nahi hai aur phone par koi alert nahi aata.',
    devanagari_transcription: 'खेत में धान रोपते समय अचानक बिजली गिरने से दो किसान मर गए, यहाँ कोई शेल्टर नहीं है और फोन पर कोई अलर्ट नहीं आता।',
    expected_category: 'disaster',
    expected_severity: 5,
    expected_priority_band: 'critical',
    expected_people_est: 100,
  },
  {
    id: 'SENT-HI-02',
    lang: 'Hindi',
    is_duplicate_target: 'SENT-HI-01', // Near-duplicate for dedup testing
    district: 'Gumla',
    text: 'Gumla Sisai gaon me kal sham bijli giri, do log khet me jhulas gaye. Hamare paas koi siren ya bachne ki jagah nahi hai.',
    devanagari_transcription: 'गुमला सिसई गांव में कल शाम बिजली गिरी, दो लोग खेत में झुलस गए। हमारे पास कोई सायरन या बचने की जगह नहीं है।',
    expected_category: 'disaster',
    expected_severity: 5,
    expected_priority_band: 'critical',
    expected_people_est: 100,
  },
  {
    id: 'SENT-HI-03',
    lang: 'Hindi',
    district: 'Sahebganj',
    text: 'Ganga nadi ka paani badhne se culvert pul doob gaya hai, 350 log phase hain aur peene ka paani do din se nahi hai.',
    devanagari_transcription: 'गंगा नदी का पानी बढ़ने से कल्वर्ट पुल डूब गया है, 350 लोग फंसे हैं और पीने का पानी दो दिन से नहीं है।',
    expected_category: 'disaster',
    expected_severity: 5,
    expected_priority_band: 'critical',
    expected_people_est: 350,
  },
  {
    id: 'SENT-HI-04',
    lang: 'Hindi',
    district: 'Palamu',
    text: 'Check dam bilkul sookh chuka hai, 250 kisanon ki arhar ki fasal mar rahi hai, solar pump se nadi se paani lift karna padega.',
    devanagari_transcription: 'चेक डैम बिल्कुल सूख चुका है, 250 किसानों की अरहर की फसल मर रही है, सोलर पंप से नदी से पानी लिफ्ट करना पड़ेगा।',
    expected_category: 'agriculture',
    expected_severity: 3,
    expected_priority_band: 'high',
    expected_people_est: 250,
  },
  {
    id: 'SENT-HI-05',
    lang: 'Hindi',
    district: 'Sahebganj',
    text: 'Barish ke karan island me saap katne ki sui aur dawa khatam ho gayi hai, mainland hospital jane ke liye boat ambulance chahiye.',
    devanagari_transcription: 'बारिश के कारण आइलैंड में सांप काटने की सुई और दवा खत्म हो गई है, मेनलैंड अस्पताल जाने के लिए बोट एम्बुलेंस चाहिए।',
    expected_category: 'health',
    expected_severity: 4,
    expected_priority_band: 'high',
    expected_people_est: 100,
  },

  // ─── 5 ENGLISH SENTENCES ───
  {
    id: 'SENT-EN-06',
    lang: 'English',
    district: 'Dhanbad',
    text: 'Fresh two-inch surface cracks appearing along school perimeter due to underground Jharia coal fire subsidence, 400 children at risk.',
    expected_category: 'disaster',
    expected_severity: 4,
    expected_priority_band: 'critical',
    expected_people_est: 400,
  },
  {
    id: 'SENT-EN-07',
    lang: 'English',
    district: 'Ranchi',
    text: 'Handpump discharge is reddish with oily foul smell, community water test shows high arsenic causing severe sickness in 500 residents.',
    expected_category: 'water',
    expected_severity: 4,
    expected_priority_band: 'high',
    expected_people_est: 500,
  },
  {
    id: 'SENT-EN-08',
    lang: 'English',
    district: 'Gumla',
    text: 'Monsoon flash flood has completely destroyed the wooden log bridge over North Koel nullah, leaving 220 high school students stranded.',
    expected_category: 'education',
    expected_severity: 4,
    expected_priority_band: 'high',
    expected_people_est: 220,
  },
  {
    id: 'SENT-EN-09',
    lang: 'English',
    district: 'Dhanbad',
    text: 'Uncovered coal dumpers generating dense particulate black dust through Katras village road, children suffering acute asthma episodes.',
    expected_category: 'environment',
    expected_severity: 3,
    expected_priority_band: 'moderate',
    expected_people_est: 100,
  },
  {
    id: 'SENT-EN-10',
    lang: 'English',
    district: 'Ranchi',
    text: 'Forty quintals of harvested tomatoes rotten on roadside in Kanke market due to extreme summer heat and absence of pre-cooling storage facility.',
    expected_category: 'agriculture',
    expected_severity: 2,
    expected_priority_band: 'long-term',
    expected_people_est: 100,
  }
];
