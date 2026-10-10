// Demo marketplace data: 50 fictional Indian creators and 50 fictional Indian brands.
// Names, handles, brands and numbers are invented for the prototype and don't refer to real people or companies.

export type Platform = "Instagram" | "YouTube" | "YouTube Shorts" | "Moj" | "Josh" | "ShareChat" | "LinkedIn" | "X";
export type CreatorCategory = "Video & UGC" | "Photography" | "Design & motion" | "Writing & strategy";

export interface SeedCreator {
  id: string;
  name: string;
  gender: "f" | "m";
  handle: string;
  title: string;
  city: string;
  state: string;
  languages: string[];
  category: CreatorCategory;
  niches: string[];
  platforms: { name: Platform; followers: number }[];
  engagement: number;
  avgViews: number;
  rating: number;
  reviews: number;
  projects: number;
  rateFrom: number;
  rateTo: number;
  turnaroundDays: number;
  availability: string;
  bio: string;
  portfolio: { title: string; brand: string; result: string }[];
  verified: boolean;
  joined: string;
}

export interface SeedClient {
  id: string;
  brand: string;
  tagline: string;
  industry: string;
  city: string;
  state: string;
  founded: number;
  size: string;
  contact: { name: string; title: string };
  description: string;
  audience: string;
  goal: string;
  budgetMonthly: [number, number];
  channels: string[];
  tone: string;
  languages: string[];
  verified: boolean;
  rating: number;
  campaigns: number;
  color: string;
  brief: {
    title: string;
    summary: string;
    deliverables: string[];
    platforms: string[];
    niches: string[];
    budget: [number, number];
    deadlineDays: number;
    creatorsNeeded: number;
    postedDaysAgo: number;
  };
}

/* ---------- deterministic numbers (same every load) ---------- */

export function seeded(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, list: readonly T[]) => list[Math.floor(r() * list.length)];
export const between = (r: () => number, lo: number, hi: number) => lo + r() * (hi - lo);
export const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/* ---------- creators ---------- */

type CreatorSeed = [
  id: string, name: string, gender: "f" | "m", handle: string, title: string, city: string, state: string,
  languages: string[], category: CreatorCategory, niches: string[], platforms: Platform[], tier: 1 | 2 | 3 | 4, bio: string,
];

const CREATOR_SEEDS: CreatorSeed[] = [
  ["c01", "Anya", "f", "@anya.frames", "Beauty & skincare creator", "Chennai", "Tamil Nadu", ["Tamil", "English"], "Video & UGC", ["Skincare", "Beauty", "Gen Z"], ["Instagram", "YouTube Shorts"], 3, "Dermat-approved routines explained in plain Tamil and English. Known for honest 7-day reviews and humid-weather skincare."],
  ["c02", "Rohan Mehta", "m", "@rohanmakesfilms", "Product filmmaker", "Mumbai", "Maharashtra", ["Hindi", "English"], "Video & UGC", ["Tech", "Gadgets", "Product films"], ["YouTube", "Instagram"], 4, "Cinematic product films shot on a one-person crew. Former ad-agency editor who turns specs into stories people finish watching."],
  ["c03", "Priya Nair", "f", "@priyacooks.kerala", "Regional food storyteller", "Kochi", "Kerala", ["Malayalam", "English"], "Video & UGC", ["Food", "Regional cuisine", "Home cooking"], ["Instagram", "YouTube"], 3, "Kerala home recipes with grandmother-approved shortcuts. Warm, slow-living visuals and recipe reels that get saved and cooked."],
  ["c04", "Kabir Singh Sodhi", "m", "@kabir.onthego", "Travel & adventure creator", "Chandigarh", "Punjab", ["Punjabi", "Hindi", "English"], "Video & UGC", ["Travel", "Adventure", "Himalayas"], ["YouTube", "Instagram"], 4, "Road trips across the Himalayas on a budget. Drone-heavy travel films with practical itineraries and homestay finds."],
  ["c05", "Meera Kulkarni", "f", "@meera.moves", "Yoga & wellness coach", "Pune", "Maharashtra", ["Marathi", "Hindi", "English"], "Video & UGC", ["Fitness", "Yoga", "Wellness"], ["Instagram", "YouTube"], 3, "Certified yoga teacher making 10-minute routines for desk workers. Calm voiceovers, clean frames and real progress stories."],
  ["c06", "Arjun Rao", "m", "@arjun.decodes", "Personal finance explainer", "Hyderabad", "Telangana", ["Telugu", "English", "Hindi"], "Writing & strategy", ["Personal finance", "Fintech", "Education"], ["YouTube", "LinkedIn", "Instagram"], 4, "Chartered accountant who explains SIPs, tax and credit in under a minute. Trusted voice for first-jobbers in Hyderabad and Bengaluru."],
  ["c07", "Sneha Banerjee", "f", "@sneha.saree.stories", "Ethnic fashion creator", "Kolkata", "West Bengal", ["Bengali", "Hindi", "English"], "Photography", ["Ethnic wear", "Fashion", "Handloom"], ["Instagram"], 3, "Handloom and saree styling with a Kolkata heart. Shoots editorial lookbooks that make weavers' work the hero."],
  ["c08", "Vikram Shetty", "m", "@vikram.lifts", "Fitness creator", "Mangaluru", "Karnataka", ["Kannada", "Tulu", "English"], "Video & UGC", ["Fitness", "Nutrition", "Gym"], ["Instagram", "YouTube Shorts"], 3, "Coastal Karnataka gym rat sharing science-backed workouts and affordable Indian meal prep."],
  ["c09", "Ishita Agarwal", "f", "@ishitadraws", "Illustrator & motion designer", "Jaipur", "Rajasthan", ["Hindi", "English"], "Design & motion", ["Illustration", "Motion graphics", "Festive"], ["Instagram", "X"], 2, "Hand-drawn animations inspired by Rajasthani miniatures. Makes festive campaigns feel crafted, not templated."],
  ["c10", "Aditya Joshi", "m", "@adityatechtalks", "Tech reviewer", "Bengaluru", "Karnataka", ["Hindi", "English", "Kannada"], "Video & UGC", ["Tech", "Gadgets", "Smartphones"], ["YouTube", "YouTube Shorts", "X"], 4, "Unboxings and 30-day reviews of budget smartphones and laptops. Straight talk, no sponsored verdicts."],
  ["c11", "Fatima Shaikh", "f", "@fatima.hijabstyle", "Modest fashion creator", "Hyderabad", "Telangana", ["Urdu", "Hindi", "English"], "Video & UGC", ["Modest fashion", "Fashion", "Beauty"], ["Instagram", "YouTube Shorts"], 3, "Modest fashion and everyday glam with Hyderabadi flair. Runs a popular Eid lookbook series every year."],
  ["c12", "Siddharth Menon", "m", "@sid.shoots", "Lifestyle photographer", "Bengaluru", "Karnataka", ["Malayalam", "English"], "Photography", ["Lifestyle", "Product photography", "Home decor"], ["Instagram"], 2, "Natural-light lifestyle and product stills. Works with D2C brands on catalogue-to-campaign shoots."],
  ["c13", "Neha Gupta", "f", "@neha.momlife", "Parenting creator", "Lucknow", "Uttar Pradesh", ["Hindi", "English"], "Video & UGC", ["Parenting", "Family", "Kids"], ["Instagram", "YouTube", "Moj"], 3, "Real-life parenting with two toddlers. Honest product trials and funny Hindi skits parents forward to each other."],
  ["c14", "Harshvardhan Patil", "m", "@harsh.autocorner", "Auto & EV reviewer", "Nagpur", "Maharashtra", ["Marathi", "Hindi"], "Video & UGC", ["Auto", "EV", "Bikes"], ["YouTube", "Instagram"], 3, "Two-wheeler and EV road tests in real city traffic. Ownership-cost breakdowns viewers actually use to decide."],
  ["c15", "Diya Chatterjee", "f", "@diya.writes", "Copywriter & content strategist", "Kolkata", "West Bengal", ["Bengali", "English"], "Writing & strategy", ["Copywriting", "Brand strategy", "LinkedIn"], ["LinkedIn", "X"], 2, "Writes scroll-stopping hooks and brand voice guides. Ex-publishing editor helping D2C founders sound human."],
  ["c16", "Rahul Verma", "m", "@rahul.laughs", "Comedy sketch creator", "Delhi", "Delhi", ["Hindi", "English"], "Video & UGC", ["Comedy", "Relatable", "Office life"], ["Instagram", "YouTube", "Moj"], 4, "Office and family sketches with a Delhi twist. Brand integrations that land as jokes, not ads."],
  ["c17", "Lakshmi Krishnan", "f", "@lakshmi.carnatic", "Music & culture creator", "Chennai", "Tamil Nadu", ["Tamil", "English"], "Video & UGC", ["Music", "Culture", "Festivals"], ["YouTube", "Instagram"], 2, "Carnatic covers and the stories behind temple festivals. Loved by NRIs and young Chennai audiences alike."],
  ["c18", "Manav Desai", "m", "@manav.eats.gujarat", "Street food explorer", "Ahmedabad", "Gujarat", ["Gujarati", "Hindi", "English"], "Video & UGC", ["Food", "Street food", "Travel"], ["Instagram", "YouTube Shorts"], 3, "Late-night street food crawls across Gujarat. Fast cuts, honest ratings and plenty of farsan."],
  ["c19", "Tanvi Reddy", "f", "@tanvi.travels.light", "Solo travel creator", "Visakhapatnam", "Andhra Pradesh", ["Telugu", "English"], "Photography", ["Travel", "Solo travel", "Beaches"], ["Instagram", "YouTube"], 3, "Solo female travel with safety-first tips. Coastal Andhra to the Andamans, shot on mirrorless and phone."],
  ["c20", "Imran Qureshi", "m", "@imran.edits", "Video editor & colourist", "Bhopal", "Madhya Pradesh", ["Hindi", "Urdu", "English"], "Design & motion", ["Editing", "Colour grading", "Reels"], ["Instagram", "YouTube"], 1, "Edits for top Indian creators behind the scenes. Fast turnaround on reels with clean captions and sound design."],
  ["c21", "Pooja Hegde Rao", "f", "@pooja.homestories", "Home decor creator", "Mysuru", "Karnataka", ["Kannada", "English"], "Photography", ["Home decor", "DIY", "Sustainability"], ["Instagram", "YouTube"], 3, "Budget home makeovers with thrifted and handmade finds. Calm before-and-after reels that rack up saves."],
  ["c22", "Nikhil Bose", "m", "@nikhil.plays", "Gaming streamer", "Kolkata", "West Bengal", ["Bengali", "Hindi", "English"], "Video & UGC", ["Gaming", "Esports", "Tech"], ["YouTube", "Instagram"], 4, "BGMI and Valorant streams with a loyal late-night community. Hardware reviews for gamers on a budget."],
  ["c23", "Ritika Malhotra", "f", "@ritika.glows", "Makeup artist", "Delhi", "Delhi", ["Hindi", "English", "Punjabi"], "Video & UGC", ["Makeup", "Bridal", "Beauty"], ["Instagram", "YouTube"], 4, "Bridal and party makeup tutorials for Indian skin tones. Product swatches across shades, every time."],
  ["c24", "Gaurav Thakur", "m", "@gaurav.pahadi", "Mountain life creator", "Dehradun", "Uttarakhand", ["Hindi", "Garhwali", "English"], "Video & UGC", ["Travel", "Slow living", "Sustainability"], ["YouTube", "Instagram"], 3, "Slow-living vlogs from a Garhwal village. Farm-to-table cooking, treks and stories of mountain makers."],
  ["c25", "Ananya Das", "f", "@ananya.northeast", "Northeast culture creator", "Guwahati", "Assam", ["Assamese", "Hindi", "English"], "Photography", ["Culture", "Travel", "Food"], ["Instagram", "YouTube"], 2, "Documents Assam's tea gardens, Bihu and Northeast kitchens. Rich, colourful frames with thoughtful captions."],
  ["c26", "Karthik Subramanian", "m", "@karthik.codes", "Tech educator", "Coimbatore", "Tamil Nadu", ["Tamil", "English"], "Writing & strategy", ["Education", "Coding", "Careers"], ["YouTube", "LinkedIn"], 3, "Teaches coding and placement prep in Tamil. Clear explainers that helped thousands land their first tech job."],
  ["c27", "Simran Kaur", "f", "@simran.bakes", "Home baker & food stylist", "Amritsar", "Punjab", ["Punjabi", "Hindi", "English"], "Photography", ["Baking", "Food", "Food styling"], ["Instagram"], 2, "Eggless bakes and dreamy food styling. Shoots for cafés and FMCG brands looking for warm, crave-worthy stills."],
  ["c28", "Aman Tiwari", "m", "@aman.upsc.notes", "Education creator", "Varanasi", "Uttar Pradesh", ["Hindi", "English"], "Writing & strategy", ["Education", "Exams", "Current affairs"], ["YouTube", "Instagram", "X"], 3, "Daily current-affairs capsules for UPSC aspirants. Crisp Hindi explainers trusted across Tier 2 cities."],
  ["c29", "Zoya Khan", "f", "@zoya.thrifts", "Sustainable fashion creator", "Mumbai", "Maharashtra", ["Hindi", "English"], "Video & UGC", ["Sustainability", "Fashion", "Thrift"], ["Instagram", "YouTube Shorts"], 3, "Thrift flips and capsule wardrobes from Mumbai's markets. Makes conscious fashion fun and affordable."],
  ["c30", "Rajat Saxena", "m", "@rajat.drone", "Aerial cinematographer", "Udaipur", "Rajasthan", ["Hindi", "English"], "Photography", ["Drone", "Weddings", "Travel"], ["Instagram", "YouTube"], 2, "Licensed drone pilot shooting palaces, lakes and destination weddings. Cinematic aerials for hospitality brands."],
  ["c31", "Bhavya Shah", "f", "@bhavya.minimal", "Lifestyle & productivity creator", "Surat", "Gujarat", ["Gujarati", "Hindi", "English"], "Video & UGC", ["Productivity", "Lifestyle", "Stationery"], ["Instagram", "YouTube"], 2, "Aesthetic desk setups, journaling and study-with-me sessions. Strong pull with college students."],
  ["c32", "Deepak Mishra", "m", "@deepak.kisan", "Agri & rural creator", "Indore", "Madhya Pradesh", ["Hindi"], "Video & UGC", ["Agriculture", "Rural", "Sustainability"], ["YouTube", "ShareChat", "Josh"], 3, "Modern farming techniques explained in simple Hindi. Huge reach in rural MP, Rajasthan and UP."],
  ["c33", "Kavya Pillai", "f", "@kavya.dances", "Dance creator", "Thiruvananthapuram", "Kerala", ["Malayalam", "Tamil", "English"], "Video & UGC", ["Dance", "Music", "Trends"], ["Instagram", "YouTube Shorts", "Moj"], 4, "Classical-meets-contemporary dance reels. Turns brand jingles into trends people actually join."],
  ["c34", "Yash Pandey", "m", "@yash.startups", "Startup & business creator", "Bengaluru", "Karnataka", ["Hindi", "English"], "Writing & strategy", ["Startups", "Business", "LinkedIn"], ["LinkedIn", "X", "YouTube"], 3, "Breaks down how Indian D2C brands grow. Founder interviews and sharp threads read by operators."],
  ["c35", "Nandini Rathore", "f", "@nandini.heritage", "Heritage & craft creator", "Jodhpur", "Rajasthan", ["Hindi", "Marwari", "English"], "Photography", ["Handicrafts", "Heritage", "Ethnic wear"], ["Instagram"], 2, "Tells the stories of block printers, potters and weavers. Editorial shoots for artisan-led brands."],
  ["c36", "Abhishek Kumar", "m", "@abhi.cricketcorner", "Cricket analyst", "Patna", "Bihar", ["Hindi", "Bhojpuri", "English"], "Video & UGC", ["Cricket", "Sports", "Fantasy sports"], ["YouTube", "Instagram", "Moj"], 4, "Match previews and fantasy tips in Hindi. Massive engagement during IPL and international series."],
  ["c37", "Shruti Deshpande", "f", "@shruti.skinscience", "Skincare scientist", "Mumbai", "Maharashtra", ["Marathi", "Hindi", "English"], "Writing & strategy", ["Skincare", "Ingredients", "Beauty"], ["Instagram", "YouTube"], 3, "Cosmetic chemist decoding ingredient lists. Brands bring her in for launch credibility and claims checks."],
  ["c38", "Tenzin Norbu", "m", "@tenzin.highlands", "Adventure photographer", "Shillong", "Meghalaya", ["English", "Khasi", "Hindi"], "Photography", ["Adventure", "Travel", "Outdoors"], ["Instagram", "YouTube"], 2, "Living root bridges, caves and monsoon clouds. Outdoor and gear shoots from India's northeast."],
  ["c39", "Pallavi Joshi", "f", "@pallavi.sustainably", "Zero-waste living creator", "Pune", "Maharashtra", ["Marathi", "English"], "Video & UGC", ["Sustainability", "Home", "Kitchen"], ["Instagram", "YouTube"], 2, "Practical zero-waste swaps for Indian kitchens. Composting, refills and budget eco-living."],
  ["c40", "Sameer Kapoor", "m", "@sameer.styles", "Menswear creator", "Delhi", "Delhi", ["Hindi", "English"], "Photography", ["Menswear", "Fashion", "Grooming"], ["Instagram", "YouTube Shorts"], 3, "Menswear styling for Indian body types and weddings. Grooming routines that don't need ten products."],
  ["c41", "Anjali Mukherjee", "f", "@anjali.reads", "Books & culture creator", "Kolkata", "West Bengal", ["Bengali", "English"], "Writing & strategy", ["Books", "Culture", "Education"], ["Instagram", "YouTube"], 2, "Indian literature recommendations and author chats. Thoughtful long-form captions with a devoted readership."],
  ["c42", "Varun Naidu", "m", "@varun.bikerides", "Motorcycle touring creator", "Bengaluru", "Karnataka", ["Telugu", "Kannada", "English"], "Video & UGC", ["Bikes", "Travel", "Auto"], ["YouTube", "Instagram"], 3, "Long-distance motorcycle tours across the Deccan. Gear tests and rider-safety content."],
  ["c43", "Riya Sen Sharma", "f", "@riya.petpals", "Pet care creator", "Gurugram", "Haryana", ["Hindi", "English"], "Video & UGC", ["Pets", "Lifestyle", "Comedy"], ["Instagram", "YouTube Shorts"], 3, "Life with two indie dogs and a cat. Pet care tips, adoption stories and very funny reels."],
  ["c44", "Omkar Jadhav", "m", "@omkar.marathi.vlogs", "Regional vlogger", "Kolhapur", "Maharashtra", ["Marathi", "Hindi"], "Video & UGC", ["Food", "Culture", "Travel"], ["YouTube", "Instagram", "Josh"], 3, "Marathi vlogs on Kolhapuri food, forts and fairs. Deep trust with Maharashtra's small-town audience."],
  ["c45", "Sana Mirza", "f", "@sana.hennaart", "Mehendi & bridal artist", "Lucknow", "Uttar Pradesh", ["Urdu", "Hindi", "English"], "Design & motion", ["Weddings", "Mehendi", "Art"], ["Instagram", "YouTube Shorts"], 2, "Intricate bridal mehendi with timelapse reels. Popular for wedding season and festive collaborations."],
  ["c46", "Pranav Hegde", "m", "@pranav.coffee", "Coffee & café creator", "Chikkamagaluru", "Karnataka", ["Kannada", "English"], "Photography", ["Coffee", "Food", "Travel"], ["Instagram"], 2, "Estate-to-cup coffee stories from Karnataka's hills. Moody product stills and café guides."],
  ["c47", "Mitali Bhatt", "f", "@mitali.mindful", "Mental wellness creator", "Ahmedabad", "Gujarat", ["Gujarati", "Hindi", "English"], "Writing & strategy", ["Mental health", "Wellness", "Lifestyle"], ["Instagram", "LinkedIn"], 2, "Counselling psychologist sharing gentle, practical mental-health tools in three languages."],
  ["c48", "Rohit Chauhan", "m", "@rohit.homechef", "Home chef", "Jaipur", "Rajasthan", ["Hindi", "English"], "Video & UGC", ["Food", "Home cooking", "Healthy eating"], ["YouTube", "Instagram", "Moj"], 4, "Quick Indian recipes for working people. Clear Hindi instructions and one-pan dinners that go viral."],
  ["c49", "Ayesha Siddiqui", "f", "@ayesha.techwomen", "Women in tech creator", "Hyderabad", "Telangana", ["Urdu", "Telugu", "English"], "Writing & strategy", ["Careers", "Tech", "Education"], ["LinkedIn", "Instagram", "YouTube"], 2, "Product manager mentoring women breaking into tech. Interview tips, salary talk and career pivots."],
  ["c50", "Devansh Arora", "m", "@devansh.animates", "3D & motion artist", "Noida", "Uttar Pradesh", ["Hindi", "English"], "Design & motion", ["3D", "Motion graphics", "Product renders"], ["Instagram", "X"], 2, "Photoreal 3D product renders and motion loops for launches. Fast iterations, studio-quality output."],
];

const TITLES_BY_NICHE: Record<string, string[]> = {
  Skincare: ["Monsoon skincare routine reel", "7-day honest serum review", "Sunscreen myth-busting series"],
  Beauty: ["Festive glam get-ready-with-me", "Everyday 5-minute makeup", "Shade-range swatch story"],
  Makeup: ["Bridal trial look tutorial", "Long-wear party makeup test", "Kajal wear test"],
  Tech: ["Budget phone 30-day review", "Laptop for students explainer", "Earbuds call-quality test"],
  Gadgets: ["Unboxing and first impressions", "Smart home setup reel", "Gadget gift guide"],
  Food: ["Regional thali recipe film", "Festive sweets series", "Kitchen staples reel"],
  "Street food": ["Night food crawl episode", "Hidden gems city guide", "Snack taste test"],
  Travel: ["Weekend itinerary film", "Homestay review series", "Monsoon road trip vlog"],
  Fitness: ["30-day home workout challenge", "Protein on a budget series", "Desk-break mobility reel"],
  Yoga: ["Morning flow for beginners", "Breathwork for stress", "Office chair yoga"],
  Fashion: ["Festive lookbook", "Wedding-guest outfits", "Capsule wardrobe reel"],
  "Ethnic wear": ["Saree draping series", "Handloom lookbook", "Festive ethnic edit"],
  "Personal finance": ["First-salary money plan", "SIP explainer", "Credit card do's and don'ts"],
  Parenting: ["School-morning routine", "Toddler snack ideas", "Parent hacks skit"],
  Comedy: ["Office relatable sketch", "Family WhatsApp group skit", "Festive chaos sketch"],
  Gaming: ["Tournament highlight reel", "Gaming phone stress test", "Setup tour"],
  Education: ["Concept-in-60-seconds series", "Exam strategy livestream", "Career guidance explainer"],
  Sustainability: ["Zero-waste swap series", "Refill store tour", "Upcycling DIY"],
  "Home decor": ["Rental-friendly room makeover", "Festive home styling", "Balcony garden glow-up"],
  Auto: ["City-traffic EV road test", "Ownership cost breakdown", "Accessories haul"],
  Cricket: ["Match preview capsule", "Fantasy tips livestream", "Fan reaction reel"],
  Weddings: ["Destination wedding film", "Bridal timelapse", "Wedding planning checklist"],
};
const DEFAULT_TITLES = ["Launch campaign reel series", "Brand story short film", "Always-on content pack"];
const RESULTS = ["1.2M views", "38% save rate", "3.4× ROAS", "+12k followers for brand", "620k reach", "9.1% engagement", "2.1M impressions", "Sold out in 48 hrs", "4.6% CTR", "480k views"];

export const AVAILABILITY = ["Available now", "Available now", "Limited slots this month", "Booking from next month"] as const;

function buildCreator(s: CreatorSeed, brands: SeedClient[]): SeedCreator {
  const [id, name, gender, handle, title, city, state, languages, category, niches, platformNames, tier, bio] = s;
  const r = seeded(id);
  const base = [0, 25_000, 120_000, 480_000, 1_400_000][tier];
  const top = [0, 90_000, 450_000, 1_300_000, 3_800_000][tier];
  const lead = roundTo(between(r, base, top), 1000);
  const platforms = platformNames.map((p, i) => ({ name: p, followers: i === 0 ? lead : roundTo(lead * between(r, 0.08, 0.55), 500) }));
  const engagement = Math.round(between(r, tier >= 4 ? 2.4 : 3.2, tier <= 2 ? 9.5 : 6.8) * 10) / 10;
  const rateFrom = roundTo([0, 8_000, 18_000, 45_000, 1_10_000][tier] * between(r, 0.85, 1.4), 1000);
  const relevant = brands.filter((b) => b.brief.niches.some((n) => niches.includes(n)) || r() < 0.08);
  const pool = relevant.length >= 3 ? relevant : brands;
  const titles = [...(TITLES_BY_NICHE[niches[0]] ?? []), ...(TITLES_BY_NICHE[niches[1]] ?? []), ...DEFAULT_TITLES];
  const portfolio = [0, 1, 2].map((i) => ({ title: titles[i % titles.length], brand: pick(r, pool).brand, result: pick(r, RESULTS) }));
  return {
    id, name, gender, handle, title, city, state, languages, category, niches, platforms, engagement,
    avgViews: roundTo(lead * between(r, 0.12, 0.6), 500),
    rating: Math.round(between(r, 4.5, 5) * 10) / 10,
    reviews: Math.round(between(r, 6, 140)),
    projects: Math.round(between(r, 8, 160)),
    rateFrom,
    rateTo: roundTo(rateFrom * between(r, 1.8, 3.2), 1000),
    turnaroundDays: Math.round(between(r, 4, 15)),
    availability: pick(r, AVAILABILITY),
    bio,
    portfolio,
    verified: r() > 0.12,
    joined: `202${Math.floor(between(r, 2, 6))}-${String(Math.floor(between(r, 1, 13))).padStart(2, "0")}`,
  };
}

/* ---------- clients ---------- */

type ClientSeed = [
  id: string, brand: string, tagline: string, industry: string, city: string, state: string, founded: number, size: string,
  contactName: string, contactTitle: string, description: string, audience: string, tone: string, languages: string[],
  briefTitle: string, briefSummary: string, deliverables: string[], platforms: string[], niches: string[], budgetTier: 1 | 2 | 3 | 4,
];

const CLIENT_SEEDS: ClientSeed[] = [
  ["b01", "Kesarika Naturals", "Ayurveda, made for today", "Beauty & wellness", "Mumbai", "Maharashtra", 2019, "11–50 people", "Nisha Rane", "Head of Brand", "Ayurvedic skincare with clinically tested formulations, sold D2C and on quick-commerce.", "Women 22–35 in metros and Tier 2 cities", "warm, credible, rooted", ["Hindi", "English", "Marathi"], "Monsoon skin reset", "Show how our kumkumadi serum fits a humid-weather routine. Honest 7-day results over polish.", ["3 Instagram Reels", "1 YouTube Short", "Usage rights 6 months"], ["Instagram", "YouTube Shorts"], ["Skincare", "Beauty"], 3],
  ["b02", "Chaiwala & Co.", "Real chai, ready in a minute", "Food & beverage", "Ahmedabad", "Gujarat", 2020, "11–50 people", "Parth Trivedi", "Co-founder", "Premixed masala chai and filter-coffee sachets for hostels, offices and busy homes.", "Students and young professionals 18–30", "playful, nostalgic, quick", ["Gujarati", "Hindi", "English"], "Hostel chai hacks", "Make our 60-second chai the hero of late-night study and office break moments.", ["4 Reels", "2 Stories sets", "Raw footage"], ["Instagram", "Moj"], ["Food", "Comedy", "Education"], 2],
  ["b03", "Voltwheel Mobility", "Electric scooters for every street", "Automotive & EV", "Bengaluru", "Karnataka", 2018, "200+ people", "Ashwin Krishnamurthy", "Marketing Director", "Electric two-wheelers with swappable batteries, built for Indian traffic and roads.", "Commuters 21–40 in Bengaluru, Pune and Hyderabad", "confident, practical, modern", ["English", "Kannada", "Telugu", "Hindi"], "Real-traffic range test", "Ride our new scooter through a full week of city commuting and share the honest range and cost.", ["1 YouTube review", "3 Reels", "Ownership-cost graphic"], ["YouTube", "Instagram"], ["Auto", "EV", "Bikes"], 4],
  ["b04", "Paisa Patri", "Money, made simple", "Fintech", "Hyderabad", "Telangana", 2021, "51–200 people", "Swathi Reddy", "Growth Lead", "Zero-fee SIP and gold-saving app for first-time investors.", "First-jobbers 21–30", "clear, trustworthy, friendly", ["Telugu", "Hindi", "English"], "First salary, first SIP", "Explain how to start investing ₹500 a month without jargon, featuring our app naturally.", ["2 explainer videos", "1 LinkedIn post", "1 Instagram carousel"], ["YouTube", "Instagram", "LinkedIn"], ["Personal finance", "Fintech", "Education"], 3],
  ["b05", "Bunkar Collective", "Handwoven, fairly made", "Fashion", "Varanasi", "Uttar Pradesh", 2016, "11–50 people", "Farah Ansari", "Founder", "Banarasi and handloom sarees sourced directly from weaver families.", "Women 28–55, festive and wedding shoppers, NRIs", "elegant, heritage, heartfelt", ["Hindi", "English"], "Weaver-to-wardrobe festive edit", "A lookbook and short film that credits the weavers behind our Diwali collection.", ["Editorial shoot — 12 stills", "1 short film (60s)", "3 Reels"], ["Instagram", "YouTube"], ["Ethnic wear", "Handloom", "Fashion"], 3],
  ["b06", "ByteNest Laptops", "Built for Indian students", "Consumer technology", "Noida", "Uttar Pradesh", 2017, "200+ people", "Karan Sethi", "Brand Manager", "Affordable laptops and tablets designed for online classes and coding.", "College students and parents", "smart, upbeat, value-led", ["Hindi", "English"], "Back-to-college laptop guide", "Help students pick the right laptop under ₹45,000 and show ours in real study and coding use.", ["1 YouTube review", "2 Shorts", "1 Instagram Reel"], ["YouTube", "YouTube Shorts"], ["Tech", "Gadgets", "Education"], 4],
  ["b07", "Mitti Mart", "Clay cookware, reimagined", "Home & kitchen", "Jaipur", "Rajasthan", 2020, "1–10 people", "Ritu Saini", "Founder", "Handmade clay and terracotta cookware with modern finishes.", "Health-conscious home cooks 25–45", "earthy, honest, slow", ["Hindi", "English"], "Cook it in clay", "Recipe reels that show the flavour difference of clay-pot cooking.", ["3 recipe Reels", "6 product stills"], ["Instagram"], ["Food", "Home cooking", "Sustainability"], 1],
  ["b08", "FitFuel India", "Protein that tastes Indian", "Health & nutrition", "Pune", "Maharashtra", 2019, "51–200 people", "Akash Joshi", "Head of Marketing", "Whey and plant protein in masala chai, kesar badam and mango flavours.", "Gym-goers and runners 20–35", "energetic, science-backed, fun", ["Hindi", "Marathi", "English"], "Desi protein challenge", "A 21-day fitness challenge where our protein fits into everyday Indian meals.", ["Challenge series — 5 Reels", "Stories", "Discount code tracking"], ["Instagram", "YouTube Shorts"], ["Fitness", "Nutrition", "Gym"], 3],
  ["b09", "Saffron Trails Hotels", "Heritage stays across Rajasthan", "Travel & hospitality", "Udaipur", "Rajasthan", 2012, "200+ people", "Devika Rathore", "Director of Marketing", "Boutique heritage hotels in restored havelis and palaces.", "Couples, weddings and international travellers", "luxurious, cinematic, warm", ["English", "Hindi"], "Palace weekend film", "A cinematic weekend stay film including drone shots of the lake and courtyards.", ["1 hero film (90s)", "4 Reels", "20 edited stills"], ["Instagram", "YouTube"], ["Travel", "Drone", "Weddings"], 4],
  ["b10", "Little Leaf Kids", "Organic clothing for little ones", "Baby & kids", "Coimbatore", "Tamil Nadu", 2021, "11–50 people", "Revathi Sundaram", "Co-founder", "Organic-cotton babywear made in Tiruppur.", "New parents 25–38", "gentle, caring, joyful", ["Tamil", "English", "Hindi"], "First birthday outfits", "Real families styling our festive kidswear for celebrations.", ["3 Reels", "Photo set", "Parent testimonial"], ["Instagram", "YouTube"], ["Parenting", "Kids", "Family"], 2],
  ["b11", "Nimbus Earbuds", "Sound for the commute", "Consumer technology", "Delhi", "Delhi", 2019, "51–200 people", "Rhea Khurana", "Influencer Lead", "Wireless earbuds and neckbands with long battery life and clear calls.", "Commuters and students 18–30", "bold, youthful, punchy", ["Hindi", "English"], "Metro noise test", "Put our ANC earbuds through a Delhi Metro commute and a noisy market.", ["2 Reels", "1 YouTube Short", "1 comparison video"], ["Instagram", "YouTube Shorts"], ["Tech", "Gadgets", "Comedy"], 3],
  ["b12", "Ghar Sajao", "Affordable home décor", "Home & living", "Surat", "Gujarat", 2018, "51–200 people", "Hetal Patel", "Marketing Manager", "Cushions, lamps, wall art and festive décor delivered across India.", "Renters and new homeowners 24–40", "cosy, colourful, practical", ["Gujarati", "Hindi", "English"], "Diwali room glow-up", "Rental-friendly festive makeovers using our new lights and décor range.", ["2 makeover Reels", "Before/after stills", "1 YouTube video"], ["Instagram", "YouTube"], ["Home decor", "DIY", "Festive"], 2],
  ["b13", "Kaapi Kadai", "South Indian filter coffee", "Food & beverage", "Chennai", "Tamil Nadu", 2015, "11–50 people", "Vignesh Raman", "Brand Head", "Single-estate filter coffee powders and decoction kits.", "Coffee lovers 25–50, South India and NRIs", "nostalgic, rich, Tamil-proud", ["Tamil", "English"], "Morning decoction ritual", "Capture the sound, aroma and ritual of a perfect filter coffee at home.", ["2 Reels", "8 product stills"], ["Instagram"], ["Coffee", "Food", "Culture"], 1],
  ["b14", "PadhaiPal", "Learn in your language", "Education", "Patna", "Bihar", 2020, "200+ people", "Rakesh Sinha", "VP Growth", "Exam-prep app with lessons in Hindi, Bhojpuri and English.", "Students 16–24 in Tier 2 and Tier 3 towns", "motivating, simple, relatable", ["Hindi", "Bhojpuri"], "Topper's daily routine", "Show how a disciplined daily plan with PadhaiPal helps crack competitive exams.", ["2 YouTube videos", "4 Shorts", "1 live session"], ["YouTube", "YouTube Shorts", "Josh"], ["Education", "Exams"], 3],
  ["b15", "Ocean Rush Swimwear", "Made for Indian beaches", "Fashion", "Panaji", "Goa", 2021, "1–10 people", "Alisha D'Souza", "Founder", "Size-inclusive swimwear and resort wear designed in Goa.", "Women 20–40 who travel", "sunny, confident, inclusive", ["English", "Konkani", "Hindi"], "Beach-day lookbook", "A sunny Goa lookbook that celebrates every body type.", ["Photo shoot — 15 stills", "3 Reels"], ["Instagram"], ["Fashion", "Travel", "Beaches"], 2],
  ["b16", "Kisan Setu", "Smarter farming, better harvests", "Agritech", "Indore", "Madhya Pradesh", 2017, "51–200 people", "Mahesh Patidar", "Head of Outreach", "Soil testing, crop advisory and input marketplace app for farmers.", "Farmers and agri-entrepreneurs", "respectful, practical, local", ["Hindi", "Marathi"], "Soil health in 7 days", "Demonstrate our soil test and advisory on a real farm, in simple Hindi.", ["2 YouTube videos", "3 ShareChat posts", "1 Josh video"], ["YouTube", "ShareChat", "Josh"], ["Agriculture", "Rural"], 2],
  ["b17", "Glow Theory", "Science-first skincare", "Beauty & wellness", "Bengaluru", "Karnataka", 2022, "11–50 people", "Tanya Bhargava", "Brand Lead", "Minimalist actives — niacinamide, ceramides and sunscreen — at honest prices.", "Ingredient-savvy 20–32", "clean, factual, approachable", ["English", "Hindi"], "Ingredient decoded", "Expert-led videos explaining our ceramide moisturiser and who it's for.", ["2 explainer Reels", "1 carousel", "Expert quote rights"], ["Instagram", "YouTube"], ["Skincare", "Ingredients"], 3],
  ["b18", "Rasoi Rani Spices", "Ghar ka swaad, every day", "Food & beverage", "Kolhapur", "Maharashtra", 2010, "200+ people", "Sunita Jadhav", "Marketing Head", "Regional spice blends — Kolhapuri, Malvani, Goda masala and more.", "Home cooks 25–55 across Maharashtra and Karnataka", "homely, bold, regional", ["Marathi", "Hindi", "Kannada"], "Regional masala series", "Five regional recipes, each built around one of our masalas.", ["5 recipe Reels", "1 YouTube recipe", "Stills"], ["YouTube", "Instagram", "Josh"], ["Food", "Home cooking", "Regional cuisine"], 3],
  ["b19", "TrekTribe Gear", "Outdoor gear for the Himalayas", "Sports & outdoors", "Dehradun", "Uttarakhand", 2016, "11–50 people", "Mohit Negi", "Co-founder", "Backpacks, jackets and trekking poles tested on Himalayan trails.", "Trekkers and backpackers 20–40", "adventurous, rugged, honest", ["Hindi", "English"], "Trail-tested review", "Take our new backpack on a multi-day trek and review it honestly.", ["1 YouTube vlog", "3 Reels", "10 stills"], ["YouTube", "Instagram"], ["Travel", "Adventure", "Outdoors"], 2],
  ["b20", "PawBowl", "Fresh food for Indian pets", "Pet care", "Gurugram", "Haryana", 2021, "11–50 people", "Sahil Grover", "Growth Manager", "Freshly cooked, vet-formulated meals for dogs and cats.", "Pet parents 24–40 in metros", "loving, fun, trustworthy", ["Hindi", "English"], "Switch-to-fresh week", "Document a pet's first week on fresh food — energy, coat and fussy eating.", ["3 Reels", "Stories", "Testimonial clip"], ["Instagram", "YouTube Shorts"], ["Pets", "Lifestyle"], 2],
  ["b21", "Lehar Water", "Mineral water with a purpose", "Food & beverage", "Kochi", "Kerala", 2019, "51–200 people", "Ann Mathew", "Brand Manager", "Packaged water in plant-based bottles with a refill programme.", "Urban 22–40, eco-conscious", "fresh, positive, mindful", ["Malayalam", "English", "Tamil"], "Refill, don't rebuy", "Show our refill stations as part of an easy low-waste routine.", ["2 Reels", "1 YouTube Short"], ["Instagram", "YouTube Shorts"], ["Sustainability", "Lifestyle"], 2],
  ["b22", "Shubh Vivah Planners", "Weddings, beautifully planned", "Weddings & events", "Delhi", "Delhi", 2014, "51–200 people", "Mansi Arora", "Creative Director", "Full-service wedding planning across North India and destination venues.", "Couples 25–34 and their families", "celebratory, premium, emotional", ["Hindi", "Punjabi", "English"], "Wedding season teaser", "Capture the build-up and big moments of a destination wedding we're planning.", ["1 wedding film", "4 Reels", "Bridal stills"], ["Instagram", "YouTube"], ["Weddings", "Makeup", "Mehendi"], 4],
  ["b23", "CodeKaro", "Coding in your mother tongue", "Education", "Coimbatore", "Tamil Nadu", 2020, "11–50 people", "Prakash Murugan", "Founder", "Beginner coding courses taught in Tamil, Telugu and Kannada.", "College students 18–24", "encouraging, clear, peer-like", ["Tamil", "Telugu", "Kannada", "English"], "Placement prep in Tamil", "A 4-part series on cracking campus placements with CodeKaro.", ["4 YouTube videos", "4 Shorts"], ["YouTube", "YouTube Shorts", "LinkedIn"], ["Education", "Coding", "Careers"], 2],
  ["b24", "Zaika Biryani House", "Hyderabadi dum since 1998", "Restaurants", "Hyderabad", "Telangana", 1998, "200+ people", "Salman Hussain", "Marketing Head", "Cloud-kitchen chain serving Hyderabadi biryani in 9 cities.", "Food lovers 18–40", "indulgent, proud, fun", ["Urdu", "Telugu", "Hindi", "English"], "Biryani taste-off", "Taste-test our new family pack against your city's favourite — honest verdict.", ["2 Reels", "1 YouTube Short"], ["Instagram", "YouTube Shorts"], ["Food", "Street food"], 2],
  ["b25", "Aangan Organics", "Farm-fresh, family-run", "Grocery", "Pune", "Maharashtra", 2017, "51–200 people", "Prachi Kulkarni", "Head of Community", "Organic vegetables, grains and dairy delivered weekly from partner farms.", "Families 28–50 in Pune and Mumbai", "wholesome, transparent, calm", ["Marathi", "Hindi", "English"], "Farm visit diaries", "Visit a partner farm and show where your weekly basket comes from.", ["1 YouTube vlog", "3 Reels", "Stills"], ["YouTube", "Instagram"], ["Sustainability", "Food", "Agriculture"], 2],
  ["b26", "Rangrez Prints", "Hand-block printed in Bagru", "Fashion", "Jaipur", "Rajasthan", 2013, "11–50 people", "Imran Rangrez", "Creative Head", "Hand-block printed kurtas, dupattas and home linen made by artisan families.", "Women 25–50 who love handcrafted fashion", "artisanal, vibrant, story-led", ["Hindi", "English"], "Behind the block", "Tell the story of one print from carving to dyeing to the final kurta.", ["Documentary short", "8 stills", "2 Reels"], ["Instagram", "YouTube"], ["Handicrafts", "Ethnic wear", "Heritage"], 2],
  ["b27", "SwiftPe", "UPI payments for small shops", "Fintech", "Bengaluru", "Karnataka", 2019, "200+ people", "Deepa Iyengar", "Brand & Content Lead", "UPI soundbox and payments app for kirana stores and street vendors.", "Small merchants and shop owners", "trustworthy, simple, local", ["Kannada", "Hindi", "Tamil", "Telugu"], "Dukaan diaries", "Short stories of shop owners growing their business with digital payments.", ["4 regional Reels", "1 YouTube film"], ["YouTube", "Instagram", "ShareChat"], ["Business", "Personal finance", "Rural"], 3],
  ["b28", "Mehfil Audio", "Speakers with desi bass", "Consumer technology", "Mumbai", "Maharashtra", 2018, "51–200 people", "Neil Fernandes", "Marketing Manager", "Party speakers and soundbars tuned for Bollywood and regional music.", "Young adults 18–30", "loud, festive, energetic", ["Hindi", "English", "Marathi"], "House-party sound test", "Throw a house party and test our speaker with Bollywood, Punjabi and dance tracks.", ["2 Reels", "1 dance trend"], ["Instagram", "Moj"], ["Music", "Dance", "Tech"], 3],
  ["b29", "Saathi Mental Health", "Therapy that understands you", "Health & wellness", "Ahmedabad", "Gujarat", 2020, "11–50 people", "Dr. Kinjal Mehta", "Clinical Director", "Online therapy with counsellors in 8 Indian languages.", "Adults 20–40, students and working professionals", "gentle, safe, stigma-free", ["Gujarati", "Hindi", "English"], "It's okay to ask", "Normalise asking for help with a soft, honest creator story.", ["2 Reels", "1 LinkedIn post", "1 carousel"], ["Instagram", "LinkedIn"], ["Mental health", "Wellness"], 2],
  ["b30", "Ride Royale Helmets", "Safety with style", "Automotive & EV", "Chennai", "Tamil Nadu", 2015, "51–200 people", "Arun Prakash", "Head of Marketing", "ISI-certified helmets and riding gear designed for Indian heat.", "Motorcycle riders 20–40", "bold, safety-first, adventurous", ["Tamil", "English", "Hindi"], "Long-ride gear test", "Test our ventilated helmet on a 1,000 km ride and review comfort and safety.", ["1 YouTube vlog", "2 Reels"], ["YouTube", "Instagram"], ["Bikes", "Travel", "Auto"], 2],
  ["b31", "Bloom Box Florals", "Same-day flowers, styled", "Gifting", "Bengaluru", "Karnataka", 2019, "11–50 people", "Shreya Rao", "Founder", "Designer bouquets and gift hampers delivered same-day in 12 cities.", "Gift buyers 22–40", "romantic, playful, premium", ["English", "Kannada", "Hindi"], "Surprise delivery reactions", "Capture real surprise reactions to our anniversary bouquets.", ["3 Reels", "Stills"], ["Instagram"], ["Lifestyle", "Relatable"], 1],
  ["b32", "Tiffin Tales", "Home-style meals, delivered", "Food & beverage", "Mumbai", "Maharashtra", 2017, "51–200 people", "Vaishali Naik", "Marketing Lead", "Subscription tiffin service with home-style Gujarati, Maharashtrian and South Indian menus.", "Working professionals and students", "comforting, reliable, homely", ["Marathi", "Hindi", "Gujarati", "English"], "Office lunch envy", "A funny take on colleagues craving your home-style lunch box.", ["2 comedy Reels", "1 Short"], ["Instagram", "YouTube Shorts"], ["Comedy", "Food", "Office life"], 2],
  ["b33", "Charkha Khadi Co.", "Khadi for the modern wardrobe", "Fashion", "Ahmedabad", "Gujarat", 2016, "11–50 people", "Hardik Vora", "Brand Head", "Contemporary khadi shirts, kurtas and co-ords spun in Gujarat.", "Men and women 25–45, conscious shoppers", "minimal, proud, sustainable", ["Gujarati", "Hindi", "English"], "Khadi in the city", "Style our khadi line for work, weekends and weddings.", ["Lookbook stills", "3 Reels"], ["Instagram"], ["Sustainability", "Menswear", "Fashion"], 2],
  ["b34", "Nirvana Yoga Retreats", "Retreats in the Himalayan foothills", "Travel & hospitality", "Rishikesh", "Uttarakhand", 2011, "11–50 people", "Ananya Bisht", "Programme Director", "Yoga and Ayurveda retreats by the Ganga for Indian and international guests.", "Wellness travellers 25–55", "serene, authentic, restorative", ["English", "Hindi"], "A week of stillness", "Document a 7-day retreat: practice, food and the view from the ghats.", ["1 YouTube film", "4 Reels", "Stills"], ["YouTube", "Instagram"], ["Yoga", "Wellness", "Travel"], 3],
  ["b35", "GameOn Arena", "India's esports home", "Gaming", "Kolkata", "West Bengal", 2020, "51–200 people", "Ritam Ghosh", "Community Lead", "Esports tournaments and a gaming café chain in East India.", "Gamers 16–28", "hype, competitive, community-first", ["Bengali", "Hindi", "English"], "Tournament hype series", "Stream and cover our inter-college BGMI tournament.", ["2 livestreams", "Highlight Reels", "Shorts"], ["YouTube", "Instagram"], ["Gaming", "Esports"], 3],
  ["b36", "Prakriti Ayurveda Clinic", "Classical Ayurveda, modern care", "Health & wellness", "Thiruvananthapuram", "Kerala", 2009, "51–200 people", "Dr. Suresh Kumar", "Medical Director", "Panchakarma and wellness programmes in a traditional Kerala setting.", "Health seekers 30–60, India and Gulf", "authentic, calm, expert", ["Malayalam", "English", "Hindi"], "Inside a Panchakarma day", "Walk viewers through a day of treatment, food and rest at the clinic.", ["1 YouTube film", "3 Reels"], ["YouTube", "Instagram"], ["Wellness", "Culture", "Travel"], 2],
  ["b37", "Kalakriti Stationery", "Made-in-India notebooks", "Stationery", "Surat", "Gujarat", 2021, "1–10 people", "Dhruvi Shah", "Founder", "Recycled-paper notebooks, planners and art supplies with Indian art covers.", "Students and journal lovers 16–30", "creative, aesthetic, cheerful", ["Gujarati", "Hindi", "English"], "Plan with me — exam season", "Study-with-me and planning content using our new exam planner.", ["3 Reels", "1 YouTube study session"], ["Instagram", "YouTube"], ["Productivity", "Stationery", "Education"], 1],
  ["b38", "UrbanNest Coliving", "Homes for young India", "Real estate", "Bengaluru", "Karnataka", 2018, "200+ people", "Rahul Menon", "Brand Director", "Fully furnished coliving spaces for students and young professionals.", "Movers 20–30 relocating to metros", "friendly, social, easy", ["English", "Hindi", "Kannada"], "First week in a new city", "Show the move-in, community events and everyday life at our coliving homes.", ["1 YouTube vlog", "3 Reels"], ["YouTube", "Instagram"], ["Lifestyle", "Relatable", "Careers"], 3],
  ["b39", "Desi Crunch Snacks", "Namkeen, but better", "Food & beverage", "Indore", "Madhya Pradesh", 2014, "200+ people", "Ankit Jain", "Head of Brand", "Baked namkeen and millet snacks with regional flavours.", "Families and young adults across India", "fun, crunchy, desi", ["Hindi", "English"], "Cricket night snack-off", "Match-night content with friends, cricket and our new millet namkeen.", ["3 Reels", "1 Short", "Match-day stories"], ["Instagram", "YouTube Shorts", "Moj"], ["Cricket", "Comedy", "Food"], 3],
  ["b40", "Shilpi Ceramics", "Hand-thrown tableware", "Home & kitchen", "Puducherry", "Puducherry", 2015, "11–50 people", "Mira Joseph", "Studio Lead", "Hand-thrown ceramic tableware from a studio by the sea.", "Design lovers 25–45", "minimal, crafted, tactile", ["English", "Tamil"], "Table for the festive season", "Style a festive table with our new glaze collection.", ["10 styled stills", "2 Reels"], ["Instagram"], ["Home decor", "Food styling", "Handicrafts"], 2],
  ["b41", "SafarNama Travels", "Small-group trips across India", "Travel & hospitality", "Delhi", "Delhi", 2016, "51–200 people", "Ishaan Malik", "Marketing Head", "Curated small-group trips to Ladakh, Spiti, the Northeast and Kerala.", "Travellers 22–38", "adventurous, social, curated", ["Hindi", "English"], "Join the Spiti batch", "Travel with a September batch and film the journey from Shimla to Kaza.", ["1 YouTube vlog", "5 Reels", "Stills"], ["YouTube", "Instagram"], ["Travel", "Adventure", "Himalayas"], 3],
  ["b42", "Nayi Soch Learning", "Spoken English for everyone", "Education", "Lucknow", "Uttar Pradesh", 2019, "51–200 people", "Shweta Srivastava", "Growth Head", "Live spoken-English and interview-skills classes taught in Hindi.", "Job seekers 18–30 in Hindi-speaking states", "encouraging, aspirational, simple", ["Hindi", "English"], "Interview confidence in 30 days", "Follow a learner's 30-day journey from nervous to confident.", ["2 YouTube videos", "4 Reels"], ["YouTube", "Instagram", "Josh"], ["Education", "Careers"], 2],
  ["b43", "Cocoa Bean Craft", "Bean-to-bar Indian chocolate", "Food & beverage", "Chikkamagaluru", "Karnataka", 2018, "11–50 people", "Rohan Gowda", "Co-founder", "Single-origin dark chocolate from Indian cacao farms.", "Gifters and foodies 25–45", "indulgent, crafted, curious", ["English", "Kannada"], "Farm to bar", "Visit our cacao partners and show how a bar is made.", ["1 short film", "8 stills", "2 Reels"], ["Instagram", "YouTube"], ["Food", "Coffee", "Food styling"], 2],
  ["b44", "StepUp Sneakers", "Sneakers designed in India", "Fashion", "Mumbai", "Maharashtra", 2020, "11–50 people", "Kunal Bhatia", "Head of Marketing", "Lightweight everyday sneakers in bold colourways.", "Men and women 18–30", "streetwise, bold, energetic", ["Hindi", "English"], "Street-style drop", "Style our new colourway across Mumbai's streets for a launch drop.", ["Lookbook", "3 Reels", "Teaser"], ["Instagram", "YouTube Shorts"], ["Fashion", "Menswear", "Dance"], 3],
  ["b45", "Arogya Labs", "Home health tests", "Healthcare", "Chennai", "Tamil Nadu", 2017, "200+ people", "Dr. Priyanka Raman", "Head of Marketing", "At-home blood test collection with reports in 24 hours.", "Adults 28–55 and their parents", "caring, reassuring, clear", ["Tamil", "English", "Hindi"], "Annual check-up for parents", "Book a full-body test for your parents and share the experience.", ["2 Reels", "1 YouTube Short"], ["Instagram", "YouTube Shorts"], ["Wellness", "Family", "Parenting"], 2],
  ["b46", "Dhaaga Weddings", "Bridal couture from Lucknow", "Fashion", "Lucknow", "Uttar Pradesh", 2012, "51–200 people", "Nazia Rizvi", "Creative Director", "Chikankari bridal and occasion wear handcrafted in Lucknow.", "Brides 24–32 and their families", "graceful, heritage, luxurious", ["Urdu", "Hindi", "English"], "Bridal trousseau edit", "A bridal shoot featuring our chikankari lehengas with makeup and mehendi.", ["Bridal shoot — 20 stills", "1 film", "3 Reels"], ["Instagram", "YouTube"], ["Weddings", "Ethnic wear", "Makeup"], 4],
  ["b47", "Brew Bros Kombucha", "Gut-friendly fizz", "Food & beverage", "Panaji", "Goa", 2020, "1–10 people", "Joel Pereira", "Co-founder", "Small-batch kombucha in Indian flavours like kokum and jamun.", "Health-curious 22–35", "breezy, quirky, healthy", ["English", "Konkani"], "Swap your soda", "Fun reels about swapping sugary drinks for our kombucha.", ["3 Reels"], ["Instagram"], ["Wellness", "Food", "Lifestyle"], 1],
  ["b48", "Jugnoo Solar", "Clean power for every home", "Energy", "Nagpur", "Maharashtra", 2016, "51–200 people", "Sachin Deshmukh", "Brand Manager", "Rooftop solar and inverter systems with easy EMI for homes.", "Homeowners 30–55 in Tier 2 cities", "trustworthy, practical, hopeful", ["Marathi", "Hindi"], "Bill zero summer", "Track a family's electricity bill before and after rooftop solar.", ["1 YouTube video", "2 Reels"], ["YouTube", "Instagram", "ShareChat"], ["Sustainability", "Home", "Personal finance"], 2],
  ["b49", "Vastra Kids Ethnic", "Festive wear for little ones", "Baby & kids", "Kolkata", "West Bengal", 2018, "11–50 people", "Moumita Saha", "Founder", "Festive ethnic wear for kids — dhoti sets, lehengas and kurtas.", "Parents 28–40", "joyful, festive, family", ["Bengali", "Hindi", "English"], "Durga Puja family looks", "Family festive styling for Puja pandal-hopping.", ["Photo set", "2 Reels"], ["Instagram"], ["Kids", "Festive", "Ethnic wear"], 1],
  ["b50", "Pixel Pulse Studio", "Design for growing brands", "Agency", "Pune", "Maharashtra", 2019, "11–50 people", "Neha Bhosale", "Partner", "Brand identity, packaging and motion design for Indian D2C startups.", "Founders and marketing teams", "sharp, creative, collaborative", ["English", "Hindi", "Marathi"], "Launch motion pack", "Commission 3D product renders and motion loops for a client launch.", ["6 motion loops", "10 3D renders"], ["Instagram", "LinkedIn"], ["3D", "Motion graphics", "Product renders"], 3],
];

const BRAND_COLORS = ["#dff6d7", "#e9e1ff", "#ffeadc", "#e0efff", "#fdf0c4", "#ffe0ea", "#d9f3f0"];
const GOALS = ["Launch a new product", "Build brand awareness", "Drive conversions", "Always-on social content"];

function buildClient(s: ClientSeed, index: number): SeedClient {
  const [id, brand, tagline, industry, city, state, founded, size, contactName, contactTitle, description, audience, tone, languages, title, summary, deliverables, platforms, niches, tier] = s;
  const r = seeded(id);
  const lo = [0, 15_000, 40_000, 90_000, 2_00_000][tier];
  const budgetLo = roundTo(lo * between(r, 0.9, 1.3), 5000);
  const monthly = roundTo(lo * between(r, 3, 6), 10_000);
  return {
    id, brand, tagline, industry, city, state, founded, size,
    contact: { name: contactName, title: contactTitle },
    description, audience, tone, languages,
    goal: pick(r, GOALS),
    budgetMonthly: [monthly, roundTo(monthly * between(r, 1.6, 2.5), 10_000)],
    channels: platforms,
    verified: r() > 0.1,
    rating: Math.round(between(r, 4.3, 5) * 10) / 10,
    campaigns: Math.round(between(r, 2, 60)),
    color: BRAND_COLORS[index % BRAND_COLORS.length],
    brief: {
      title, summary, deliverables, platforms, niches,
      budget: [budgetLo, roundTo(budgetLo * between(r, 1.4, 2.2), 5000)],
      deadlineDays: Math.round(between(r, 7, 30)),
      creatorsNeeded: Math.max(1, Math.round(between(r, 1, 6))),
      postedDaysAgo: Math.round(between(r, 0, 12)),
    },
  };
}

export const CLIENTS: SeedClient[] = CLIENT_SEEDS.map(buildClient);
export const CREATORS: SeedCreator[] = CREATOR_SEEDS.map((s) => buildCreator(s, CLIENTS));

/* ---------- formatting ---------- */

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const formatINR = (n: number) => inr.format(n);
/** ₹45k, ₹1.2L — compact Indian money for cards. */
export function formatINRShort(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(n % 1_00_00_000 ? 1 : 0)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(n % 1_00_000 ? 1 : 0)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}k`;
  return `₹${n}`;
}
export function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}
export const totalFollowers = (c: SeedCreator) => c.platforms.reduce((s, p) => s + p.followers, 0);

/* ---------- matching ---------- */

/** A transparent fit score between a creator and a brand brief (or a signed-in client's profile). */
export function matchScore(c: SeedCreator, want: { niches?: string[]; platforms?: string[]; languages?: string[]; budgetMax?: number }): number {
  const r = seeded(c.id + (want.niches ?? []).join());
  let score = 62 + r() * 6;
  const niches = want.niches ?? [];
  score += Math.min(3, c.niches.filter((n) => niches.includes(n)).length) * 9;
  score += Math.min(2, c.platforms.filter((p) => want.platforms?.some((w) => p.name.startsWith(w) || w.startsWith(p.name))).length) * 3;
  score += c.languages.some((l) => want.languages?.includes(l)) ? 4 : 0;
  if (want.budgetMax && c.rateFrom > want.budgetMax) score -= 8;
  score += (c.rating - 4.5) * 6 + Math.min(4, c.engagement / 2);
  return Math.max(55, Math.min(99, Math.round(score)));
}
