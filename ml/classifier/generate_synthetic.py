"""Synthetic messy citizen reports with exact labels.

Each report = problem phrase (carries category, dm_phase, base severity)
            + optional duration / escalation cue (raises severity)
            + optional vulnerable-group cues (multi-label)
            + optional place and people count
rendered in Devanagari Hindi, Roman Hindi, English or a mix, then roughened
like a real SMS (dropped vowels, abbreviations, no punctuation, typos).

    python ml/classifier/generate_synthetic.py --n 12000
"""
import argparse
import json
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import DATA  # noqa: E402

# (category, dm_phase, base_severity, [devanagari], [roman], [english])
PROBLEMS = [
    # disaster_safety
    ("disaster_safety", "preparedness", 4,
     ["खेत में बिजली गिरी", "आसमान से बिजली गिरने से", "वज्रपात हुआ"],
     ["khet me bijli giri", "aasman se bijli girne se", "vajrapat hua", "thanka gira"],
     ["lightning struck in the field", "lightning strike near the village"]),
    ("disaster_safety", "response", 5,
     ["गांव में बाढ़ आ गई", "नदी का पानी घरों में घुस गया"],
     ["gaon me baadh aa gayi", "nadi ka pani gharo me ghus gaya", "badh se ghar doob gaye"],
     ["flood water entered the houses", "the river flooded our village"]),
    ("disaster_safety", "response", 4, ["जंगल में आग लगी है"], ["jungle me aag lagi hai", "jangal jal raha"], ["forest fire spreading"]),
    ("disaster_safety", "response", 4, ["घरों में आग लग गई"], ["gharo me aag lag gayi", "basti me aag"], ["fire broke out in houses"]),
    ("disaster_safety", "mitigation", 3,
     ["जमीन धंस रही है", "खदान के पास दरार आ गई"],
     ["zameen dhans rahi hai", "khadan ke paas darar aa gayi"],
     ["land is sinking near the mine", "cracks in the ground near the mine"]),
    ("disaster_safety", "response", 4,
     ["हाथी गांव में घुस आए", "हाथियों ने घर तोड़ दिए"],
     ["hathi gaon me ghus aaye", "hathiyon ne ghar tod diye"],
     ["elephants entered the village", "elephants destroyed houses"]),
    ("disaster_safety", "preparedness", 3,
     ["आंधी तूफान की कोई चेतावनी नहीं मिलती", "सायरन नहीं है गांव में"],
     ["aandhi toofan ki koi chetavni nahi milti", "siren nahi hai gaon me"],
     ["no storm warning reaches us", "there is no siren in the village"]),
    # water
    ("water", "response", 4,
     ["पीने का पानी नहीं है", "नल से पानी नहीं आ रहा"],
     ["peene ka pani nahi hai", "nal se pani nahi aa raha", "pani nahi mil raha"],
     ["no drinking water", "the tap has no water"]),
    ("water", "mitigation", 3,
     ["चापाकल खराब है", "हैंडपंप टूटा हुआ है"],
     ["chapakal kharab hai", "handpump toota hua hai", "chapakal band"],
     ["the hand pump is broken", "handpump not working"]),
    ("water", "response", 4,
     ["पानी गंदा और बदबूदार आ रहा है", "कुएं का पानी पीला हो गया"],
     ["pani ganda aur badbudar aa raha", "kuen ka pani peela ho gaya"],
     ["the water is dirty and smells", "well water turned yellow"]),
    ("water", "mitigation", 3,
     ["तालाब सूख गया", "कुआं सूख गया गर्मी में"],
     ["talab sookh gaya", "kuan sookh gaya garmi me"],
     ["the pond has dried up", "the well dried up this summer"]),
    # health
    ("health", "response", 4, ["बच्चों को दस्त और उल्टी हो रही है"], ["bacchon ko dast aur ulti ho rahi", "ulti dast ho raha"], ["children have diarrhoea and vomiting"]),
    ("health", "response", 4, ["गांव में बुखार फैला है"], ["gaon me bukhar faila hai", "malaria fail raha"], ["fever is spreading in the village"]),
    ("health", "mitigation", 3,
     ["स्वास्थ्य केंद्र में डॉक्टर नहीं आते", "पीएचसी बंद रहता है"],
     ["swasthya kendra me doctor nahi aate", "phc band rehta hai", "hospital me dawai nahi"],
     ["no doctor comes to the health centre", "the PHC is always closed"]),
    ("health", "response", 5, ["एंबुलेंस नहीं आई मरीज की हालत गंभीर"], ["ambulance nahi aayi mareez ki halat gambhir", "108 nahi aayi"], ["ambulance did not come, patient is serious"]),
    ("health", "response", 5, ["सांप काटा है अस्पताल दूर है"], ["saanp kata hai hospital door hai", "sanp ne kaata"], ["snake bite and the hospital is far"]),
    # education
    ("education", "mitigation", 2, ["स्कूल में शिक्षक नहीं आते"], ["school me teacher nahi aate", "master ji nahi aate"], ["teachers do not come to school"]),
    ("education", "mitigation", 2, ["स्कूल की छत टपकती है"], ["school ki chhat tapakti hai", "school me pani tapakta"], ["the school roof leaks"]),
    ("education", "recovery", 2,
     ["बाढ़ के बाद स्कूल बंद है", "किताबें भीग कर खराब हो गईं"],
     ["baadh ke baad school band hai", "kitaben bheeg kar kharab ho gayi"],
     ["school closed since the flood", "books were ruined by water"]),
    ("education", "mitigation", 1, ["बच्चों के लिए कंप्यूटर नहीं है"], ["bacchon ke liye computer nahi hai"], ["no computers for students"]),
    ("education", "mitigation", 1, ["मिड डे मील ठीक नहीं मिलता"], ["mid day meal theek nahi milta", "khichdi kharab milti"], ["mid day meal is poor"]),
    # agriculture
    ("agriculture", "recovery", 3,
     ["फसल बर्बाद हो गई", "धान की फसल सूख गई"],
     ["fasal barbad ho gayi", "dhaan ki fasal sookh gayi", "kheti chaupat"],
     ["the crop is ruined", "paddy crop dried up"]),
    ("agriculture", "mitigation", 2, ["सिंचाई का कोई साधन नहीं"], ["sinchai ka koi sadhan nahi", "khet me pani nahi pahunchta"], ["no irrigation facility"]),
    ("agriculture", "mitigation", 2, ["बीज और खाद समय पर नहीं मिलता"], ["beej aur khad samay par nahi milta", "urea nahi mila"], ["seeds and fertiliser come late"]),
    ("agriculture", "response", 3,
     ["फसल में कीड़े लग गए", "टिड्डी ने खेत खा लिया"],
     ["fasal me keede lag gaye", "tiddi ne khet kha liya"],
     ["pests attacked the crop", "locusts ate the field"]),
    # roads_infra
    ("roads_infra", "mitigation", 3, ["सड़क टूटी हुई है"], ["sadak tooti hui hai", "rasta kharab"], ["the road is broken"]),
    ("roads_infra", "mitigation", 3, ["पुलिया बह गई"], ["puliya beh gayi", "puliya toot gayi"], ["the culvert washed away"]),
    ("roads_infra", "response", 4,
     ["पुल टूट गया गांव कट गया", "रास्ता बंद है कोई आ जा नहीं सकता"],
     ["pul toot gaya gaon kat gaya", "rasta band hai koi aa ja nahi sakta"],
     ["the bridge collapsed and the village is cut off", "the road is blocked, nobody can get in or out"]),
    ("roads_infra", "mitigation", 2, ["स्कूल की दीवार गिरने वाली है"], ["school ki deewar girne wali hai"], ["the school wall may collapse"]),
    ("roads_infra", "mitigation", 2, ["सामुदायिक भवन जर्जर है"], ["samudayik bhawan jarjar hai"], ["the community hall is in ruins"]),
    # energy_connectivity
    ("energy_connectivity", "mitigation", 2,
     ["कई दिनों से बिजली नहीं है", "ट्रांसफार्मर जल गया"],
     ["kai dino se light nahi hai", "transformer jal gaya", "bijli nahi aa rahi"],
     ["no electricity for days", "the transformer burnt out"]),
    ("energy_connectivity", "preparedness", 3,
     ["मोबाइल नेटवर्क नहीं मिलता", "गांव में टावर नहीं है"],
     ["mobile network nahi milta", "gaon me tower nahi hai", "signal nahi aata"],
     ["there is no mobile network", "no tower in our village"]),
    ("energy_connectivity", "response", 4,
     ["बिजली का तार टूट कर गिरा है", "खंभा गिर गया करंट फैला है"],
     ["bijli ka taar toot kar gira hai", "khamba gir gaya current faila hai"],
     ["a live wire fell on the road", "the pole fell and the wire is live"]),
    # environment
    ("environment", "mitigation", 2,
     ["कोयले की धूल से सांस लेने में दिक्कत", "फैक्ट्री का धुआं बहुत है"],
     ["koyle ki dhool se saans lene me dikkat", "factory ka dhuan bahut hai"],
     ["coal dust makes it hard to breathe", "heavy smoke from the factory"]),
    ("environment", "mitigation", 2, ["पेड़ अवैध रूप से काटे जा रहे हैं"], ["ped awaidh roop se kaate ja rahe"], ["trees are being cut illegally"]),
    ("environment", "mitigation", 2, ["नदी में कचरा फेंका जाता है"], ["nadi me kachra phenka jata hai"], ["garbage is dumped in the river"]),
    ("environment", "preparedness", 3,
     ["बहुत गर्मी है लू चल रही है", "गर्मी से लोग बेहोश हो रहे हैं"],
     ["bahut garmi hai loo chal rahi", "garmi se log behosh ho rahe"],
     ["extreme heat wave", "people are fainting from the heat"]),
]

# Wider sector checklist (added after v1 memorised the small bank above).
PROBLEMS += [
    ("disaster_safety", "response", 4, ["भूस्खलन से घर दब गए"], ["landslide se ghar dab gaye", "pahad dhas gaya"], ["a landslide buried houses"]),
    ("disaster_safety", "response", 4, ["ओले और तेज हवा से छप्पर उड़ गए"], ["ole aur tez hawa se chhappar udd gaye", "aandhi me chhat udd gayi"], ["hail and strong wind blew roofs away"]),
    ("disaster_safety", "preparedness", 3, ["बाढ़ के समय जाने के लिए कोई ऊंची जगह नहीं"], ["baadh me jaane ke liye koi unchi jagah nahi", "shelter nahi hai"], ["no safe high ground or shelter during floods"]),
    ("disaster_safety", "response", 4, ["डैम का गेट खोला पानी तेजी से बढ़ रहा"], ["dam ka gate khola pani tezi se badh raha", "barrage ka pani chhoda"], ["the dam gates opened and water is rising fast"]),
    ("disaster_safety", "mitigation", 3, ["तालाब में डूबने का खतरा, कोई घेरा नहीं"], ["pokhar me doobne ka khatra", "talab ke kinare ghera nahi"], ["drowning risk at the pond, no fencing"]),
    ("disaster_safety", "response", 4, ["भालू ने हमला किया", "जंगली जानवर गांव में"], ["bhalu ne hamla kiya", "jangli janwar gaon me"], ["a bear attacked a villager", "wild animals entering the village"]),
    ("disaster_safety", "response", 5, ["मकान गिर गया लोग दबे हैं"], ["makaan gir gaya log dabe hai", "kachcha ghar dhah gaya"], ["a house collapsed and people are trapped"]),
    ("water", "response", 3, ["टैंकर नहीं आया"], ["tanker nahi aaya", "paani ki gaadi nahi aayi"], ["the water tanker did not come"]),
    ("water", "mitigation", 2, ["जल मीनार बनी पर चालू नहीं"], ["jal minar bani par chalu nahi", "paani tanki kharab", "pipeline leak"], ["the water tower was built but never started", "pipeline is leaking"]),
    ("water", "response", 4, ["पानी में आर्सेनिक फ्लोराइड है", "पानी पीने से दांत पीले"], ["paani me fluoride hai", "arsenic wala pani", "pani se daant peele"], ["fluoride in the drinking water", "arsenic contamination"]),
    ("water", "mitigation", 3, ["दूर से पानी ढोना पड़ता है"], ["door se pani dhona padta", "nadi se pani laate", "dadi ko pani lana padta"], ["we carry water from far away"]),
    ("water", "mitigation", 2, ["नाली का पानी कुएं में जाता है"], ["nali ka pani kuen me jata", "gandagi pani me"], ["drain water seeps into the well"]),
    ("health", "response", 4, ["पीलिया फैल गया", "टाइफाइड के मरीज बढ़ रहे"], ["peelia fail gaya", "typhoid ke mareez badh rahe", "jaundice"], ["jaundice outbreak", "typhoid cases rising"]),
    ("health", "mitigation", 3, ["मच्छर बहुत हैं मलेरिया डेंगू का डर"], ["machhar bahut hai", "dengue ka dar", "fogging nahi hui"], ["too many mosquitoes, fear of malaria and dengue"]),
    ("health", "mitigation", 3, ["टीकाकरण नहीं हुआ", "एएनएम नहीं आती"], ["tikakaran nahi hua", "ANM nahi aati", "sahiya nahi aati", "vaccine nahi laga"], ["children missed vaccination", "the health worker does not visit"]),
    ("health", "response", 4, ["दवाई खत्म हो गई", "इंसुलिन नहीं मिल रहा"], ["dawai khatam ho gayi", "insulin nahi mil raha", "medicine shop band"], ["medicines have run out", "cannot get insulin"]),
    ("health", "mitigation", 3, ["कुपोषण से बच्चे कमजोर"], ["kuposhan se bache kamzor", "anganwadi me poshahar nahi"], ["children are malnourished"]),
    ("health", "response", 5, ["प्रसव पीड़ा में महिला अस्पताल नहीं पहुंच पाई"], ["prasav me mahila hospital nahi pahunchi", "delivery ghar pe hui khatra"], ["woman in labour could not reach hospital"]),
    ("health", "response", 3, ["जानवर के काटने की सुई नहीं"], ["kutta kaata sui nahi mili", "rabies ka injection nahi"], ["no anti-rabies injection available"]),
    ("education", "mitigation", 2, ["लड़कियों के लिए शौचालय नहीं"], ["ladkiyon ke liye shauchalay nahi", "school me toilet nahi"], ["no toilet for girls at school"]),
    ("education", "mitigation", 2, ["एक ही शिक्षक सब कक्षा पढ़ाते हैं"], ["ek hi master sab class", "teacher ki kami", "padhai nahi hoti"], ["one teacher for all classes"]),
    ("education", "mitigation", 2, ["ऑनलाइन पढ़ाई नहीं हो पाती"], ["online padhai nahi ho pati", "smart class band", "library nahi"], ["students cannot study online", "no library"]),
    ("education", "mitigation", 3, ["स्कूल जाने के रास्ते में नदी पार करनी पड़ती है"], ["school jaane me nadi paar karni padti", "school door hai"], ["children cross a stream to reach school"]),
    ("education", "recovery", 2, ["स्कूल राहत शिविर बना है पढ़ाई बंद"], ["school relief camp bana hai", "padhai band hai mahine se"], ["the school is a relief camp and classes stopped"]),
    ("education", "mitigation", 1, ["छात्रवृत्ति नहीं मिली", "साइकिल नहीं मिली"], ["scholarship nahi mili", "cycle nahi mili", "dress kitab nahi mili"], ["scholarship not received", "no uniforms or books"]),
    ("agriculture", "response", 3, ["पशुओं में बीमारी फैली", "बकरियां मर रही"], ["pashu me bimari", "bakri mar rahi", "gai bimar", "pashu doctor nahi"], ["livestock disease spreading", "goats are dying"]),
    ("agriculture", "recovery", 3, ["ओलावृष्टि से फसल नष्ट"], ["ole se fasal nasht", "gehun sarso barbad", "barish se dhaan gal gaya"], ["hailstorm destroyed the crop"]),
    ("agriculture", "mitigation", 2, ["मंडी तक सब्जी ले जाने का साधन नहीं"], ["mandi tak le jaane ka sadhan nahi", "sabzi sad rahi", "sahi daam nahi milta"], ["no way to take vegetables to market", "no fair price for produce"]),
    ("agriculture", "mitigation", 2, ["मिट्टी जांच नहीं होती", "कौन सी खाद डालें पता नहीं"], ["mitti jaanch nahi", "kaun si khad pata nahi", "krishi mitra nahi aate"], ["no soil testing", "no advice on fertiliser"]),
    ("agriculture", "mitigation", 3, ["बारिश नहीं हुई रोपनी रुकी"], ["barish nahi hui ropni ruki", "bichda sookh raha", "sukha pad gaya"], ["no rain, transplanting stopped", "drought this season"]),
    ("agriculture", "recovery", 3, ["खेत में बालू भर गया"], ["khet me balu bhar gaya", "khet kat gaya"], ["sand filled the fields after the flood"]),
    ("roads_infra", "mitigation", 3, ["कच्ची सड़क कीचड़ बन जाती है"], ["kachi sadak keechad", "barsat me rasta band", "khaat pe mareez le jaate"], ["the dirt road turns to mud"]),
    ("roads_infra", "mitigation", 3, ["नदी पर पुल नहीं"], ["nadi par pul nahi", "nala paar nahi kar sakte", "chachri pul"], ["no bridge over the river"]),
    ("roads_infra", "response", 4, ["पत्थर गिरकर रास्ता बंद"], ["patthar gir ke rasta band", "ped gir ke sadak band"], ["rocks fell and blocked the road", "a fallen tree blocks the road"]),
    ("roads_infra", "mitigation", 3, ["भवन की छत से प्लास्टर गिरता है"], ["bhawan ki chhat se plaster girta", "anganwadi bhawan jarjar", "deewar me darar"], ["plaster falling from the building roof"]),
    ("roads_infra", "mitigation", 3, ["रेलवे फाटक नहीं है", "सड़क पर गड्ढे से दुर्घटना"], ["railway phatak nahi", "gaddhe se accident", "speed breaker nahi"], ["unmanned railway crossing", "potholes causing accidents"]),
    ("energy_connectivity", "mitigation", 3, ["सोलर लाइट खराब"], ["solar light kharab", "street light band", "solar pump band"], ["solar lights not working"]),
    ("energy_connectivity", "mitigation", 3, ["हाई वोल्टेज तार घर के ऊपर से"], ["high voltage taar ghar ke upar", "11000 volt ka taar", "taar jhool raha"], ["high voltage line hanging over houses"]),
    ("energy_connectivity", "response", 4, ["बिजली नहीं तो ऑक्सीजन मशीन बंद"], ["light nahi to machine band", "inverter bhi khatam"], ["power cut stops a medical machine"]),
    ("energy_connectivity", "mitigation", 2, ["इंटरनेट नहीं चलता बैंक का काम रुका"], ["internet nahi chalta", "net nahi hai", "csc band"], ["no internet, banking stopped"]),
    ("energy_connectivity", "preparedness", 3, ["फोन करने के लिए पहाड़ पर चढ़ना पड़ता"], ["call karne pahad pe chadhna padta", "ek hi jagah network"], ["we climb a hill to make a call"]),
    ("environment", "mitigation", 3, ["खदान का काला पानी खेत में"], ["kolyari ka pani khet me", "khadan ka kaala pani", "rakh ka pani"], ["black mine water flowing into fields"]),
    ("environment", "mitigation", 2, ["ईंट भट्टे का धुआं"], ["bhatta ka dhuan", "chimney ka dhuan", "dhool udti hai"], ["smoke from the brick kiln", "dust everywhere"]),
    ("environment", "mitigation", 3, ["नदी से बालू का अवैध खनन"], ["balu ka awaidh khanan", "nadi se ret nikal rahe", "sand mafia"], ["illegal sand mining in the river"]),
    ("environment", "mitigation", 2, ["नाले में प्लास्टिक कचरा भर गया"], ["nale me plastic kachra", "kooda jalate hai", "gali me kachra"], ["plastic waste clogging the drain", "garbage burning"]),
    ("environment", "mitigation", 3, ["जंगल कट गया तो जानवर गांव आते"], ["jungle kat gaya", "ped kat rahe", "hariyali khatam"], ["deforestation around the village"]),
    ("environment", "preparedness", 3, ["लू में मजदूरों के लिए छाया पानी नहीं"], ["loo me majdooron ke liye chhaya nahi", "paara 45 paar", "tapti garmi"], ["no shade or water for labourers in the heat"]),
]


# ---------------------------------------------------------------------------
# Synonym layer. Real reporters use many words for the same thing, and a model
# only knows what it has seen. Swapping words at render time multiplies the
# vocabulary the classifier meets without writing hundreds more templates.
# ---------------------------------------------------------------------------
SYNONYMS: dict[str, list[str]] = {
    # water
    "chapakal": ["chapakal", "handpump", "hand pump", "nalka", "nal", "boring", "chuan", "chapa kal"],
    "pani": ["pani", "paani", "panee", "jal", "water"],
    "kuan": ["kuan", "kuaan", "well", "kuwan", "inaar"],
    "talab": ["talab", "pokhar", "pond", "tank", "aahar"],
    # health
    "doctor": ["doctor", "daktar", "doctor babu", "chikitsak", "MO sahab"],
    "dawai": ["dawai", "dawa", "medicine", "goli", "davai"],
    "mareez": ["mareez", "marij", "patient", "bimar aadmi", "rogi"],
    "hospital": ["hospital", "aspatal", "PHC", "CHC", "health centre", "swasthya kendra", "dawakhana", "sadar aspatal"],
    "bimari": ["bimari", "bimaari", "rog", "disease", "sankraman"],
    # education
    "school": ["school", "skool", "vidyalaya", "pathshala", "madhyamik school", "primary school"],
    "teacher": ["teacher", "master", "master ji", "shikshak", "guruji", "sir"],
    "bachche": ["bachche", "bacche", "bachhe", "bachcho", "children", "ladke ladkiyan", "chhatra", "students"],
    # agriculture
    "fasal": ["fasal", "crop", "kheti", "upaj", "paidawar"],
    "khet": ["khet", "field", "kheti ki zameen", "bakhar"],
    "kisan": ["kisan", "farmer", "krishak", "kheti karne wale"],
    # roads
    "sadak": ["sadak", "road", "rasta", "path", "marg", "gali"],
    "pul": ["pul", "bridge", "puliya", "culvert", "chachri pul"],
    # energy
    "bijli": ["bijli", "light", "current", "power", "vidyut", "bijali"],
    "transformer": ["transformer", "transformar", "TC", "trasformer"],
    "network": ["network", "signal", "tower", "mobile network", "range"],
    # generic verbs and states
    "kharab": ["kharab", "toota", "toot gaya", "band", "bekar", "jawab de gaya", "fail", "thap", "nakara"],
    "nahi": ["nahi", "nhi", "nai", "ni", "nahin", "na"],
    "bahut": ["bahut", "bht", "bohot", "kaafi", "jyada", "bhot"],
    "gaon": ["gaon", "gav", "gaw", "village", "tola", "basti", "mohalla", "tola gaon"],
    "log": ["log", "logo", "people", "aadmi", "parivar", "gramin"],
    "problem": ["problem", "dikkat", "samasya", "pareshani", "takleef"],
    "jaldi": ["jaldi", "jldi", "turant", "shighra", "abhi"],
    "madad": ["madad", "madat", "help", "sahayata", "sahyog"],
}
# Longest first, so "hand pump" wins over "pump".
_SYN_KEYS = sorted({k for k in SYNONYMS}, key=len, reverse=True)


def synonymise(s: str, rng: random.Random) -> str:
    """Swap known words for a random real-world variant."""
    out = s
    for key in _SYN_KEYS:
        if key in out.lower() and rng.random() < 0.75:
            variants = SYNONYMS[key]
            pattern = re.compile(re.escape(key), re.IGNORECASE)
            out = pattern.sub(lambda _m: rng.choice(variants), out, count=1)
    return out


# Openers and closers a real message carries around the actual problem.
OPENERS = ["", "", "", "sir ", "namaskar sir ", "johar sir ", "sir ji ", "hello ", "gaon walon ki taraf se ",
           "mai ", "hamare yahan ", "hamare tola me ", "sir hamare gaon me ", "request hai ki "]
CLOSERS = ["", "", "", " kripya dhyan dijiye", " please dekhiye", " jaldi karwa dijiye", " koi sunta nahi",
           " kai baar bol chuke hai", " dhanyawad", " sir help kijiye", " report kar raha hu", " sudhar karwaye"]

ESCALATE = [  # (+severity, dev, roman, english)
    (1, ["दो लोगों की मौत हो गई", "एक आदमी मर गया"], ["do logo ki maut ho gayi", "ek aadmi mar gaya", "2 log mare"], ["two people died", "one man died"]),
    (1, ["कई लोग घायल हैं"], ["kai log ghayal hai"], ["many people injured"]),
    (1, ["तुरंत मदद चाहिए"], ["turant madad chahiye", "jaldi madad karo", "urgent help"], ["need help immediately"]),
    (0, ["तीन दिन से"], ["3 din se", "teen din se", "hafte bhar se"], ["for three days", "since last week"]),
    (0, ["कोई सुनता नहीं"], ["koi sunta nahi", "kai baar bola"], ["nobody listens", "complained many times"]),
    (-1, ["कभी कभी होता है"], ["kabhi kabhi hota hai", "thoda dikkat hai"], ["happens sometimes", "a small problem"]),
]

VULN = {
    "children": (["छोटे बच्चे", "स्कूल के बच्चे"], ["chhote bacche", "bachhe", "school ke bache"], ["small children", "school kids"]),
    "elderly": (["बुजुर्ग", "बूढ़े लोग"], ["buzurg", "budhe log", "dada dadi"], ["elderly people", "old people"]),
    "disability": (["विकलांग", "दिव्यांग व्यक्ति"], ["viklang", "divyang aadmi", "chal nahi sakte"], ["disabled person", "people who cannot walk"]),
    "pregnancy": (["गर्भवती महिला"], ["garbhvati mahila", "pregnant aurat", "delivery hone wali hai"], ["pregnant woman"]),
    "medical_dependency": (["डायलिसिस वाले मरीज", "बीमार मरीज"], ["dialysis wale mareez", "sugar bp ke mareez", "oxygen wale mareez"], ["patients on dialysis", "patients who need medicine daily"]),
    "isolated": (["गांव पूरी तरह कटा है", "कोई गाड़ी नहीं पहुंचती"], ["gaon kata hua hai", "koi gaadi nahi pahunchti", "jungle ke andar gaon"], ["the village is cut off", "no vehicle can reach"]),
    "no_signal": (["नेटवर्क नहीं है"], ["network nahi hai", "phone nahi lagta"], ["no phone signal", "calls do not connect"]),
}

DISTRICTS = ["Gumla", "Sahebganj", "Palamu", "Garhwa", "Dhanbad", "Bokaro", "Ranchi", "Lohardaga", "Simdega",
             "Khunti", "Latehar", "Chatra", "Dumka", "Pakur", "Godda", "Giridih", "Hazaribagh", "Koderma",
             "Ramgarh", "Jamtara", "Deoghar", "West Singhbhum", "East Singhbhum", "Seraikela"]
VILLAGES = ["Sisai", "Bharno", "Raidih", "Basia", "Chainpur", "Barhait", "Taljhari", "Rajmahal", "Chhatarpur",
            "Bishunpur", "Kolebira", "Torpa", "Manika", "Nala", "Kundhit", "Jarmundi", "Litipara", "Mandro"]
ABBR = {"nahi": ["nhi", "nai", "nahin"], "hai": ["h", "he", "hai"], "gaon": ["gav", "gaon", "gaw"],
        "pani": ["paani", "pani", "panee"], "bahut": ["bht", "bahut", "bohot"], "log": ["log", "logo"],
        "madad": ["madat", "madad", "help"], "jaldi": ["jldi", "jaldi"], "please": ["plz", "pls"]}


def roughen(s: str, rng: random.Random) -> str:
    words = s.split()
    out = []
    for w in words:
        lw = w.lower()
        if lw in ABBR and rng.random() < 0.5:
            w = rng.choice(ABBR[lw])
        elif len(w) > 4 and rng.random() < 0.06:  # drop a vowel / typo
            i = rng.randrange(1, len(w) - 1)
            w = w[:i] + w[i + 1:]
        out.append(w)
    s = " ".join(out)
    if rng.random() < 0.3:
        s = s.upper() if rng.random() < 0.2 else s.lower()
    return s


def pick(bank, script, rng):
    dev, rom, en = bank
    if script == "dev":
        return rng.choice(dev)
    if script == "rom":
        return rng.choice(rom)
    return rng.choice(en)


def people_phrase(n, script, rng):
    if script == "dev":
        return rng.choice([f"{n} लोग परेशान हैं", f"{n} परिवार प्रभावित", "पूरा गांव परेशान"])
    if script == "rom":
        return rng.choice([f"{n} log pareshan", f"{n} parivar", "pura gaon pareshan", f"approx {n} log"])
    return rng.choice([f"{n} people affected", f"about {n} families", "the whole village is affected"])


def make(rng: random.Random) -> dict:
    pid = rng.randrange(len(PROBLEMS))
    cat, phase, sev, *bank = PROBLEMS[pid]
    script = rng.choices(["dev", "rom", "en", "mix"], weights=[3, 5, 2, 2])[0]
    s = lambda b: pick(b, rng.choice(["dev", "rom", "en"]) if script == "mix" else script, rng)  # noqa: E731
    parts = [s(bank)]

    for delta, *eb in rng.sample(ESCALATE, k=rng.choice([0, 0, 1, 1, 2])):
        parts.append(s(eb))
        sev += delta

    vul = sorted(rng.sample(list(VULN), k=rng.choices([0, 1, 2, 3], weights=[4, 4, 2, 1])[0]))
    for v in vul:
        parts.append(s(VULN[v]) + rng.choice(["", " bhi", " hai", " pareshan"] if script == "rom" else [""]))
    if vul:
        sev += 1 if len(vul) >= 2 else 0

    if rng.random() < 0.6:
        parts.append(people_phrase(rng.choice([15, 40, 80, 120, 200, 350, 500, 1200]), script, rng))
    if rng.random() < 0.7:
        place = rng.choice([rng.choice(VILLAGES) + " " + rng.choice(DISTRICTS), rng.choice(DISTRICTS)])
        parts.insert(rng.choice([0, len(parts)]), place)

    if rng.random() < 0.3:
        tail = parts[1:]
        rng.shuffle(tail)
        parts[1:] = tail
    sep = rng.choice([" ", ". ", ", ", " - ", " "])
    text = sep.join(parts)
    if script in ("rom", "mix") or rng.random() < 0.4:
        text = synonymise(text, rng)
    if rng.random() < 0.45:
        text = rng.choice(OPENERS) + text + rng.choice(CLOSERS)
    text = roughen(text, rng) if script != "en" or rng.random() < 0.3 else text
    return {"text": text, "category": cat, "dm_phase": phase,
            "severity": max(1, min(5, sev)), "vulnerable": vul, "script": script, "problem_id": pid}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=12000)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    rng = random.Random(a.seed)
    seen, rows = set(), []
    while len(rows) < a.n:
        r = make(rng)
        if r["text"] not in seen:
            seen.add(r["text"])
            rows.append(r)
    out = DATA / "classifier"
    out.mkdir(parents=True, exist_ok=True)
    with open(out / "synthetic.jsonl", "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"wrote {len(rows)} -> {out / 'synthetic.jsonl'}")
    for r in rows[:8]:
        print(r)
