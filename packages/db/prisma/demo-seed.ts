/**
 * Phase 4 demo seed: 4 sellers, 80 products across 8 categories.
 *
 *   pnpm db:seed:demo            # idempotent upsert
 *   pnpm db:seed:demo --reset    # delete demo sellers + their products first
 *
 * Sellers are flagged `isDemo: true`, which excludes them from the Stripe
 * payouts sweep. Images point at Unsplash so this works with no S3 setup.
 *
 * Re-runnable: keyed off Seller.slug + Product.slug, so existing rows update
 * cleanly. Variants are wiped + recreated to keep prices/stock fresh.
 */
import { prisma } from '../src';

type DemoSeller = {
  slug: string;
  email: string;
  legalName: string;
  displayName: string;
  countryCode: string;
  description: string;
};

const SELLERS: DemoSeller[] = [
  {
    slug: 'lumen-electronics',
    email: 'demo-lumen@onsective.com',
    legalName: 'Lumen Electronics LLC',
    displayName: 'Lumen Electronics',
    countryCode: 'US',
    description: 'Premium audio, charging, and desk gear from Boston.',
  },
  {
    slug: 'kintsugi-home',
    email: 'demo-kintsugi@onsective.com',
    legalName: 'Kintsugi Home Pvt Ltd',
    displayName: 'Kintsugi Home',
    countryCode: 'IN',
    description: 'Handcrafted kitchenware, ceramics, and home textiles.',
  },
  {
    slug: 'fern-and-fable',
    email: 'demo-fern@onsective.com',
    legalName: 'Fern & Fable Co.',
    displayName: 'Fern & Fable',
    countryCode: 'US',
    description: 'Indie books, journals, and small-batch stationery.',
  },
  {
    slug: 'midori-beauty',
    email: 'demo-midori@onsective.com',
    legalName: 'Midori Beauty Co.',
    displayName: 'Midori Beauty',
    countryCode: 'US',
    description: 'Clean skincare, fragrance, and haircare — vegan, never tested on animals.',
  },
];

type DemoProduct = {
  slug: string;
  title: string;
  brand: string;
  bullets: string[];
  description: string;
  images: string[]; // unsplash.com URLs, sized via ?w=1200
  price: number; // minor units
  mrp?: number;
  currency: 'USD' | 'INR';
  weightGrams: number;
  ratingAvg: number;
  ratingCount: number;
  salesCount: number;
};

// Eight curated products per category × 8 categories = 64. We pad to 80 with
// 16 extras spread across the high-traffic categories.
type CategoryDemo = {
  slug: string; // matches base seed
  sellerSlug: string;
  products: DemoProduct[];
};

function ux(id: string, w = 1200): string {
  // Unsplash IDs (verified to exist as of authoring); the host responds with
  // CORS-friendly redirects to images.unsplash.com.
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
}

const ELECTRONICS: DemoProduct[] = [
  {
    slug: 'lumen-aurora-wireless-headphones',
    title: 'Aurora Wireless Over-Ear Headphones',
    brand: 'Lumen',
    bullets: ['40mm dynamic drivers', '38h battery', 'Active noise cancelling', 'USB-C fast charge'],
    description: 'Studio-grade comfort for listeners who care about every detail. The Aurora pairs warm 40mm dynamic drivers with hybrid ANC that adapts to your environment in real time.',
    images: [ux('1505740420928-5e560c06d30e'), ux('1583394838336-acd977736f90')],
    price: 19900,
    mrp: 24900,
    currency: 'USD',
    weightGrams: 320,
    ratingAvg: 4.6,
    ratingCount: 842,
    salesCount: 1254,
  },
  {
    slug: 'lumen-pulse-earbuds',
    title: 'Pulse True-Wireless Earbuds',
    brand: 'Lumen',
    bullets: ['IPX5 sweatproof', '8h playback / 32h with case', 'Bluetooth 5.3', 'Wireless charging'],
    description: 'Compact buds tuned for the gym and the commute. Auto-pause on removal, multipoint pairing, and a case that tops up over Qi.',
    images: [ux('1572569511254-d8f925fe2cbb'), ux('1590658268037-6bf12165a8df')],
    price: 8900,
    mrp: 11900,
    currency: 'USD',
    weightGrams: 60,
    ratingAvg: 4.4,
    ratingCount: 631,
    salesCount: 980,
  },
  {
    slug: 'lumen-deskpad-charger',
    title: 'DeskPad 3-in-1 Wireless Charger',
    brand: 'Lumen',
    bullets: ['Charges phone, watch, earbuds', 'PD 20W passthrough', 'Vegan leather finish'],
    description: 'A single pad for your phone, watch, and earbud case. Magnetic alignment for iPhone, Qi for everything else.',
    images: [ux('1591290619762-dccf3aac9f2c'), ux('1606220588913-b3aacb4d2f46')],
    price: 6900,
    mrp: 8900,
    currency: 'USD',
    weightGrams: 280,
    ratingAvg: 4.3,
    ratingCount: 412,
    salesCount: 587,
  },
  {
    slug: 'lumen-orbit-webcam-4k',
    title: 'Orbit 4K Streaming Webcam',
    brand: 'Lumen',
    bullets: ['4K @ 30fps / 1080p @ 60fps', 'Auto-framing', 'Privacy shutter', 'USB-C plug-and-play'],
    description: 'Look your sharpest in every meeting. Wide-angle lens, AI auto-framing, and a hardware privacy shutter you can actually trust.',
    images: [ux('1611532736597-de2d4265fba3')],
    price: 12900,
    currency: 'USD',
    weightGrams: 180,
    ratingAvg: 4.5,
    ratingCount: 289,
    salesCount: 431,
  },
  {
    slug: 'lumen-arc-keyboard',
    title: 'Arc Mechanical Keyboard 75%',
    brand: 'Lumen',
    bullets: ['Hot-swap switches', 'Aluminium top plate', 'Per-key RGB', 'Mac + Windows layouts'],
    description: 'A 75% mechanical board that gets out of the way. Gasket mount, PBT keycaps, and switches you can swap without a soldering iron.',
    images: [ux('1587829741301-dc798b83add3'), ux('1595044426077-d36d9236d54a')],
    price: 14900,
    mrp: 18900,
    currency: 'USD',
    weightGrams: 920,
    ratingAvg: 4.7,
    ratingCount: 1043,
    salesCount: 1670,
  },
  {
    slug: 'lumen-loft-monitor-stand',
    title: 'Loft Walnut Monitor Stand',
    brand: 'Lumen',
    bullets: ['Solid walnut', 'Cable channel underneath', 'Holds up to 32" / 18kg'],
    description: 'A monitor riser that earns its place on a beautiful desk. Each piece is finished by hand and signed underneath.',
    images: [ux('1593642632559-0c6d3fc62b89')],
    price: 7900,
    currency: 'USD',
    weightGrams: 1800,
    ratingAvg: 4.4,
    ratingCount: 178,
    salesCount: 215,
  },
  {
    slug: 'lumen-shift-usb-c-hub',
    title: 'Shift 8-in-1 USB-C Hub',
    brand: 'Lumen',
    bullets: ['HDMI 4K@60', 'Gigabit Ethernet', 'SD/microSD reader', '100W passthrough'],
    description: 'Every port your laptop forgot. Solid aluminium body that sinks heat instead of trapping it.',
    images: [ux('1583863788434-e58a36330cf0')],
    price: 5900,
    mrp: 7900,
    currency: 'USD',
    weightGrams: 110,
    ratingAvg: 4.2,
    ratingCount: 502,
    salesCount: 768,
  },
  {
    slug: 'lumen-glow-desk-lamp',
    title: 'Glow Adaptive Desk Lamp',
    brand: 'Lumen',
    bullets: ['Auto-dim from ambient', 'Wireless charging base', '3000-6500K range'],
    description: 'A lamp that learns your room. The base ramps brightness as the sun sets and tops up your phone while you work.',
    images: [ux('1572297797905-0bdc67e58f93')],
    price: 8900,
    currency: 'USD',
    weightGrams: 950,
    ratingAvg: 4.5,
    ratingCount: 364,
    salesCount: 488,
  },
  {
    slug: 'lumen-flux-power-bank',
    title: 'Flux 20,000 mAh Power Bank',
    brand: 'Lumen',
    bullets: ['100W USB-C PD', 'Charges laptop in 60 min', 'Airport-friendly'],
    description: 'Enough capacity to recover a 13" laptop from empty. Magnetic alignment for compatible phones, four ports for everything else.',
    images: [ux('1609592091073-2d1d40e25f9e')],
    price: 6900,
    mrp: 9900,
    currency: 'USD',
    weightGrams: 460,
    ratingAvg: 4.6,
    ratingCount: 819,
    salesCount: 1340,
  },
  {
    slug: 'lumen-canvas-laptop-sleeve',
    title: 'Canvas Laptop Sleeve 14"',
    brand: 'Lumen',
    bullets: ['Waxed canvas exterior', 'Shock-absorbent foam', 'Hidden cable pocket'],
    description: 'A sleeve that ages well. The waxed canvas darkens with use; the foam stays as protective as day one.',
    images: [ux('1603039463945-72b14eb1c895')],
    price: 4900,
    currency: 'USD',
    weightGrams: 240,
    ratingAvg: 4.3,
    ratingCount: 256,
    salesCount: 318,
  },
];

const FASHION: DemoProduct[] = [
  {
    slug: 'kintsugi-organic-cotton-tee',
    title: 'Organic Cotton Crewneck Tee',
    brand: 'Kintsugi',
    bullets: ['100% GOTS organic cotton', 'Pre-shrunk', 'Sized for layering'],
    description: 'A heavyweight tee built to outlast trends. We use long-staple Indian cotton spun in a single mill we visit twice a year.',
    images: [ux('1521572163474-6864f9cf17ab'), ux('1581655353564-df123a1eb820')],
    price: 3900,
    mrp: 4900,
    currency: 'USD',
    weightGrams: 220,
    ratingAvg: 4.4,
    ratingCount: 1102,
    salesCount: 2210,
  },
  {
    slug: 'kintsugi-linen-shirt',
    title: 'Stonewashed Linen Shirt',
    brand: 'Kintsugi',
    bullets: ['100% European linen', 'Mother-of-pearl buttons', 'Garment-washed for softness'],
    description: 'The shirt you reach for when the weather doesn’t agree with you. Breathable in summer, layerable in autumn.',
    images: [ux('1602810318383-e386cc2a3ccf')],
    price: 7900,
    mrp: 9500,
    currency: 'USD',
    weightGrams: 320,
    ratingAvg: 4.5,
    ratingCount: 478,
    salesCount: 612,
  },
  {
    slug: 'kintsugi-tailored-trousers',
    title: 'Tailored Wool Trousers',
    brand: 'Kintsugi',
    bullets: ['Italian wool blend', 'Half-canvas waistband', 'Hidden side adjusters'],
    description: 'Trousers that hold a press but breathe like a chino. Cut from a 250gsm Italian wool blend with a touch of stretch.',
    images: [ux('1594938298603-c8148c4dae35')],
    price: 11900,
    currency: 'USD',
    weightGrams: 540,
    ratingAvg: 4.3,
    ratingCount: 219,
    salesCount: 274,
  },
  {
    slug: 'kintsugi-knit-cardigan',
    title: 'Merino Knit Cardigan',
    brand: 'Kintsugi',
    bullets: ['100% merino wool', 'Horn buttons', 'Naturally odour-resistant'],
    description: 'The travel layer that disappears into a backpack and reappears unwrinkled. Pure merino, knit at 12-gauge.',
    images: [ux('1620799140188-3b2a02fd9a77')],
    price: 12900,
    mrp: 15900,
    currency: 'USD',
    weightGrams: 380,
    ratingAvg: 4.6,
    ratingCount: 612,
    salesCount: 798,
  },
  {
    slug: 'kintsugi-leather-belt',
    title: 'Hand-Stitched Leather Belt',
    brand: 'Kintsugi',
    bullets: ['Vegetable-tanned leather', 'Solid brass buckle', 'Will patina with use'],
    description: 'A belt that’s an investment, not an accessory. Saddle-stitched by hand and finished with a solid brass buckle.',
    images: [ux('1624222247344-550fb60583dc')],
    price: 5900,
    currency: 'USD',
    weightGrams: 180,
    ratingAvg: 4.7,
    ratingCount: 341,
    salesCount: 422,
  },
  {
    slug: 'kintsugi-canvas-tote',
    title: 'Heavy Canvas Daily Tote',
    brand: 'Kintsugi',
    bullets: ['18oz canvas', 'Reinforced base', 'Internal zip pocket'],
    description: 'Built for groceries, books, or a laptop and a thermos — whatever the day demands. The base is reinforced so it actually stands up.',
    images: [ux('1591561954555-607968c989ab')],
    price: 4500,
    currency: 'USD',
    weightGrams: 480,
    ratingAvg: 4.4,
    ratingCount: 893,
    salesCount: 1402,
  },
  {
    slug: 'kintsugi-wool-cap',
    title: 'Lambswool Watch Cap',
    brand: 'Kintsugi',
    bullets: ['Pure lambswool', 'Cuffed for warmth', 'Heritage Yorkshire mill'],
    description: 'Knit by a mill that’s been making caps since 1888. Warm without itch, dense without weight.',
    images: [ux('1612886623516-50ab41fbac38')],
    price: 3500,
    mrp: 4500,
    currency: 'USD',
    weightGrams: 110,
    ratingAvg: 4.5,
    ratingCount: 234,
    salesCount: 356,
  },
  {
    slug: 'kintsugi-canvas-sneakers',
    title: 'Canvas Court Sneakers',
    brand: 'Kintsugi',
    bullets: ['Vulcanized rubber sole', 'Cushioned insole', 'Replaceable laces'],
    description: 'A sneaker that quietly goes with everything. Soft canvas upper, vulcanized sole, lace-up the way they used to.',
    images: [ux('1542291026-7eec264c27ff')],
    price: 8900,
    currency: 'USD',
    weightGrams: 600,
    ratingAvg: 4.2,
    ratingCount: 521,
    salesCount: 743,
  },
];

const HOME: DemoProduct[] = [
  {
    slug: 'kintsugi-stoneware-mug',
    title: 'Hand-Thrown Stoneware Mug',
    brand: 'Kintsugi',
    bullets: ['Wheel-thrown in Jaipur', '350ml capacity', 'Dishwasher safe'],
    description: 'Each mug is thrown by hand, so no two are identical. The glaze pools differently in every piece — that’s the point.',
    images: [ux('1514228742587-6b1558fcca3d'), ux('1517248135467-4c7edcad34c4')],
    price: 2900,
    currency: 'USD',
    weightGrams: 380,
    ratingAvg: 4.7,
    ratingCount: 891,
    salesCount: 1620,
  },
  {
    slug: 'kintsugi-cast-iron-pan',
    title: 'Cast Iron Skillet 10"',
    brand: 'Kintsugi',
    bullets: ['Pre-seasoned with flaxseed oil', 'Triple-coat seasoning', 'Made to outlive you'],
    description: 'A skillet that gets better every time you cook in it. Triple seasoned at the foundry; ready to sear out of the box.',
    images: [ux('1556909114-f6e7ad7d3136')],
    price: 6900,
    mrp: 8900,
    currency: 'USD',
    weightGrams: 1900,
    ratingAvg: 4.8,
    ratingCount: 1456,
    salesCount: 2189,
  },
  {
    slug: 'kintsugi-linen-tablecloth',
    title: 'Stonewashed Linen Tablecloth',
    brand: 'Kintsugi',
    bullets: ['100% European flax', 'Mitred corners', 'Pre-washed for drape'],
    description: 'The kind of tablecloth that softens with every wash. Stonewashed so it drapes from the moment you unfold it.',
    images: [ux('1604147495798-57beb5d6af73')],
    price: 7900,
    currency: 'USD',
    weightGrams: 720,
    ratingAvg: 4.5,
    ratingCount: 287,
    salesCount: 389,
  },
  {
    slug: 'kintsugi-walnut-cutting-board',
    title: 'End-Grain Walnut Cutting Board',
    brand: 'Kintsugi',
    bullets: ['End-grain construction', 'Self-healing surface', 'Conditioned with food-safe wax'],
    description: 'End-grain walnut absorbs the knife edge instead of dulling it. The board lasts longer; your knives stay sharper.',
    images: [ux('1567696911980-2eed69a46042')],
    price: 9900,
    mrp: 12900,
    currency: 'USD',
    weightGrams: 2100,
    ratingAvg: 4.6,
    ratingCount: 412,
    salesCount: 567,
  },
  {
    slug: 'kintsugi-cotton-bath-towel',
    title: 'Turkish Cotton Bath Towel',
    brand: 'Kintsugi',
    bullets: ['600gsm long-staple cotton', 'Aegean Sea origin', 'Gets softer every wash'],
    description: 'Long-staple Turkish cotton woven on traditional looms. Heavy when dry, plush when wet, and it ages beautifully.',
    images: [ux('1620626011761-996317b8d101')],
    price: 4900,
    currency: 'USD',
    weightGrams: 600,
    ratingAvg: 4.5,
    ratingCount: 678,
    salesCount: 902,
  },
  {
    slug: 'kintsugi-rattan-pendant',
    title: 'Hand-Woven Rattan Pendant Light',
    brand: 'Kintsugi',
    bullets: ['Hand-woven rattan', 'E27 socket', 'Includes 3m fabric cord'],
    description: 'A pendant that throws shadows you’ll want to live with. Each shade is woven by hand from naturally dried rattan.',
    images: [ux('1565538810643-b5bdb714032a')],
    price: 11900,
    currency: 'USD',
    weightGrams: 980,
    ratingAvg: 4.4,
    ratingCount: 198,
    salesCount: 234,
  },
  {
    slug: 'kintsugi-marble-pestle-mortar',
    title: 'Carrara Marble Mortar & Pestle',
    brand: 'Kintsugi',
    bullets: ['Solid Carrara marble', 'Honed interior', 'Felt-lined base'],
    description: 'For the cook who grinds spices fresh. Heavy, cold, and beautiful enough to leave on the counter.',
    images: [ux('1517240128893-a2e8fc14b76f')],
    price: 5900,
    currency: 'USD',
    weightGrams: 2400,
    ratingAvg: 4.6,
    ratingCount: 312,
    salesCount: 421,
  },
  {
    slug: 'kintsugi-french-press',
    title: 'Borosilicate French Press 1L',
    brand: 'Kintsugi',
    bullets: ['Heat-resistant borosilicate', 'Stainless filter', 'Cork handle'],
    description: 'A French press without plastic. Borosilicate carafe, dual-mesh stainless filter, and a cork handle that stays cool.',
    images: [ux('1580632330562-4a6d4cc09f63')],
    price: 4900,
    mrp: 6500,
    currency: 'USD',
    weightGrams: 720,
    ratingAvg: 4.5,
    ratingCount: 542,
    salesCount: 803,
  },
];

const BEAUTY: DemoProduct[] = [
  {
    slug: 'midori-glow-serum',
    title: 'Glow Vitamin C Serum',
    brand: 'Midori',
    bullets: ['15% L-ascorbic acid', 'Hyaluronic acid', 'Vegan, fragrance-free', '30ml'],
    description: 'A morning serum your skin will keep asking for. Stable L-ascorbic acid in a low-pH base, with hyaluronic acid to keep it gentle.',
    images: [ux('1573461160327-b450ce3d8e7f'), ux('1612817288484-6f916006741a')],
    price: 4500,
    mrp: 5500,
    currency: 'USD',
    weightGrams: 90,
    ratingAvg: 4.6,
    ratingCount: 1203,
    salesCount: 1845,
  },
  {
    slug: 'midori-cloud-cleanser',
    title: 'Cloud Cream Cleanser',
    brand: 'Midori',
    bullets: ['pH 5.5', 'No sulfates', 'Calming oat extract', '150ml'],
    description: 'A cleanser that respects your barrier. Foams just enough to feel clean, never enough to feel stripped.',
    images: [ux('1556228720-195a672e8a03')],
    price: 2900,
    currency: 'USD',
    weightGrams: 200,
    ratingAvg: 4.4,
    ratingCount: 678,
    salesCount: 921,
  },
  {
    slug: 'midori-quartz-roller',
    title: 'Rose Quartz Facial Roller',
    brand: 'Midori',
    bullets: ['Genuine rose quartz', 'Squeak-free axle', 'Travel pouch included'],
    description: 'For the post-cleanse minute that makes the rest of your day calmer. The rollers are checked for cracks one at a time.',
    images: [ux('1610379070317-6d27a1a64aa1')],
    price: 3500,
    currency: 'USD',
    weightGrams: 110,
    ratingAvg: 4.3,
    ratingCount: 412,
    salesCount: 589,
  },
  {
    slug: 'midori-night-balm',
    title: 'Overnight Repair Balm',
    brand: 'Midori',
    bullets: ['Squalane + ceramides', 'No fragrance', '50ml jar', 'Vegan'],
    description: 'A heavy-duty overnight balm for skin that needs the deep end. Squalane and ceramides do the work while you sleep.',
    images: [ux('1620916566398-39f1143ab7be')],
    price: 5900,
    mrp: 7500,
    currency: 'USD',
    weightGrams: 100,
    ratingAvg: 4.7,
    ratingCount: 856,
    salesCount: 1102,
  },
  {
    slug: 'midori-sun-shield-spf50',
    title: 'Daily Sun Shield SPF 50',
    brand: 'Midori',
    bullets: ['Mineral filters', 'No white cast', 'Reef-safe', '50ml'],
    description: 'A mineral SPF that disappears on every skin tone. Zinc and titanium dioxide in a silky, fragrance-free base.',
    images: [ux('1556228578-8c89e6adf883')],
    price: 4200,
    currency: 'USD',
    weightGrams: 80,
    ratingAvg: 4.5,
    ratingCount: 1342,
    salesCount: 2104,
  },
  {
    slug: 'midori-fig-perfume',
    title: 'Wild Fig Eau de Parfum',
    brand: 'Midori',
    bullets: ['50ml glass bottle', 'Notes: green fig, oakmoss, vetiver', 'IFRA-compliant'],
    description: 'A fragrance for the first walk after rain. Green fig over a damp wood base, with vetiver to keep it from getting sweet.',
    images: [ux('1592945403244-b3fbafd7f539')],
    price: 8900,
    currency: 'USD',
    weightGrams: 320,
    ratingAvg: 4.6,
    ratingCount: 423,
    salesCount: 612,
  },
];

const BOOKS: DemoProduct[] = [
  {
    slug: 'fern-letterpress-journal',
    title: 'Letterpress Lined Journal',
    brand: 'Fern & Fable',
    bullets: ['Letterpress cover', '160 cream-coloured pages', 'Lay-flat binding'],
    description: 'A journal printed one cover at a time on a Heidelberg from the 1960s. Lays flat, won’t bleed through, ages gracefully.',
    images: [ux('1531346878377-a5be20888e57'), ux('1532153975070-2e9ab71f1b14')],
    price: 2900,
    currency: 'USD',
    weightGrams: 360,
    ratingAvg: 4.5,
    ratingCount: 567,
    salesCount: 894,
  },
  {
    slug: 'fern-poetry-anthology',
    title: 'A Slow Year — Poetry Anthology',
    brand: 'Fern & Fable',
    bullets: ['Hardcover, 240 pages', '52 poems, one per week', 'Linen cover'],
    description: 'A collection of contemporary poetry — one poem for each week of the year. Linen-bound, cloth-marked, made to be re-read.',
    images: [ux('1544716278-ca5e3f4abd8c')],
    price: 3500,
    mrp: 4200,
    currency: 'USD',
    weightGrams: 520,
    ratingAvg: 4.7,
    ratingCount: 213,
    salesCount: 287,
  },
  {
    slug: 'fern-ink-pen-set',
    title: 'Glass Ink Pen Set',
    brand: 'Fern & Fable',
    bullets: ['Hand-blown glass nib', '15ml ink pot', 'Gift-boxed'],
    description: 'A glass-nib pen and bottle of indigo ink, made for the kind of writing you want to remember.',
    images: [ux('1583936125737-fd1d29ed1c2a')],
    price: 4900,
    currency: 'USD',
    weightGrams: 220,
    ratingAvg: 4.4,
    ratingCount: 156,
    salesCount: 198,
  },
  {
    slug: 'fern-photo-book',
    title: 'Wild Coasts — Photography Book',
    brand: 'Fern & Fable',
    bullets: ['Hardcover, 192 pages', 'Smyth-sewn binding', 'Printed in Italy'],
    description: 'Five years of coastal photography from the North Atlantic. Printed in Verona on heavy matte stock.',
    images: [ux('1543002588-bfa74002ed7e')],
    price: 5900,
    currency: 'USD',
    weightGrams: 1400,
    ratingAvg: 4.8,
    ratingCount: 89,
    salesCount: 112,
  },
  {
    slug: 'fern-bookends-brass',
    title: 'Solid Brass Bookends (Pair)',
    brand: 'Fern & Fable',
    bullets: ['Solid brass', 'Felt-lined base', 'Ages to a soft patina'],
    description: 'Solid brass bookends that hold up real books. They’re heavier than they look — that’s the whole point.',
    images: [ux('1524995997946-a1c2e315a42f')],
    price: 6900,
    currency: 'USD',
    weightGrams: 1800,
    ratingAvg: 4.6,
    ratingCount: 134,
    salesCount: 178,
  },
  {
    slug: 'fern-reading-lamp',
    title: 'Walnut Reading Lamp',
    brand: 'Fern & Fable',
    bullets: ['Solid walnut base', 'Articulated arm', 'Warm 2700K LED'],
    description: 'A reading lamp that points the light where it should be: at the page, never the room.',
    images: [ux('1565374790989-0bd1de29b08f')],
    price: 8900,
    mrp: 11900,
    currency: 'USD',
    weightGrams: 1200,
    ratingAvg: 4.5,
    ratingCount: 234,
    salesCount: 312,
  },
];

const TOYS: DemoProduct[] = [
  {
    slug: 'fern-wooden-blocks',
    title: 'Beechwood Building Blocks (50pc)',
    brand: 'Fern & Fable',
    bullets: ['50 pieces', 'Naturally finished beechwood', 'Cotton storage bag'],
    description: 'A starter set of natural beechwood blocks with no plastic and no batteries. Sanded smooth and finished with food-safe oil.',
    images: [ux('1519327232521-1ea2c736d34d'), ux('1503602642458-232111445657')],
    price: 5900,
    mrp: 7500,
    currency: 'USD',
    weightGrams: 1800,
    ratingAvg: 4.7,
    ratingCount: 421,
    salesCount: 598,
  },
  {
    slug: 'fern-cotton-plush-bear',
    title: 'Organic Cotton Plush Bear',
    brand: 'Fern & Fable',
    bullets: ['Organic cotton fill', 'Hand-embroidered face', 'Machine washable'],
    description: 'A soft, washable bear with no plastic eyes — the face is hand-embroidered.',
    images: [ux('1571423408867-bde3e8e6c14a')],
    price: 3900,
    currency: 'USD',
    weightGrams: 320,
    ratingAvg: 4.5,
    ratingCount: 287,
    salesCount: 389,
  },
  {
    slug: 'fern-puzzle-world-map',
    title: 'World Map Wooden Puzzle (75pc)',
    brand: 'Fern & Fable',
    bullets: ['75 pieces', 'Birch ply', 'Hand-screen-printed'],
    description: 'A wooden world map puzzle for kids who love geography (and adults who pretend they don’t).',
    images: [ux('1606092195730-5d7b9af1efc5')],
    price: 4900,
    currency: 'USD',
    weightGrams: 480,
    ratingAvg: 4.6,
    ratingCount: 165,
    salesCount: 213,
  },
  {
    slug: 'fern-paint-set',
    title: 'Watercolour Paint Set (24)',
    brand: 'Fern & Fable',
    bullets: ['24 artist-grade pans', 'Refillable tin', 'Two travel brushes'],
    description: 'A travel watercolour kit that’s actually fun to paint with. Twenty-four lightfast pans, refillable, with two pocket brushes.',
    images: [ux('1513364776144-60967b0f800f')],
    price: 5900,
    currency: 'USD',
    weightGrams: 320,
    ratingAvg: 4.4,
    ratingCount: 198,
    salesCount: 256,
  },
  {
    slug: 'fern-wooden-train',
    title: 'Wooden Train Track Starter',
    brand: 'Fern & Fable',
    bullets: ['38 wooden track pieces', 'Compatible with major brands', 'Chunky for small hands'],
    description: 'A starter wooden train set built to last more than one childhood. Heirloom-quality joints and chunky pieces for early hands.',
    images: [ux('1512917774080-9991f1c4c750')],
    price: 6900,
    currency: 'USD',
    weightGrams: 1100,
    ratingAvg: 4.5,
    ratingCount: 312,
    salesCount: 423,
  },
  {
    slug: 'fern-balance-board',
    title: 'Wooden Balance Board',
    brand: 'Fern & Fable',
    bullets: ['FSC-certified birch', 'Felt underside', 'For ages 3+'],
    description: 'An open-ended toy that becomes a bridge, a slide, a rocking chair, a fort. Felt-backed so it doesn’t scratch floors.',
    images: [ux('1604881988759-f5a0f4bb2bfe')],
    price: 7900,
    mrp: 9900,
    currency: 'USD',
    weightGrams: 1600,
    ratingAvg: 4.7,
    ratingCount: 234,
    salesCount: 298,
  },
];

const GROCERY: DemoProduct[] = [
  {
    slug: 'midori-matcha-100g',
    title: 'Ceremonial Grade Matcha (100g)',
    brand: 'Midori',
    bullets: ['Single-origin Uji', 'Stone-milled', 'Resealable foil pouch'],
    description: 'Single-origin Uji matcha, stone-milled in small batches and shipped within weeks of grinding so the colour is still electric.',
    images: [ux('1515823064-d6e0c04616a7')],
    price: 3500,
    currency: 'USD',
    weightGrams: 120,
    ratingAvg: 4.6,
    ratingCount: 542,
    salesCount: 821,
  },
  {
    slug: 'midori-cold-brew-coffee',
    title: 'Cold Brew Coffee Concentrate (1L)',
    brand: 'Midori',
    bullets: ['Single-origin Ethiopian', '1L glass bottle', 'Refrigerate after opening'],
    description: 'Brewed for 18 hours, bottled the same day. Single-origin Ethiopian beans, no additives.',
    images: [ux('1517701604599-bb29b565090c')],
    price: 1900,
    currency: 'USD',
    weightGrams: 1100,
    ratingAvg: 4.4,
    ratingCount: 412,
    salesCount: 678,
  },
  {
    slug: 'midori-honey-wildflower',
    title: 'Raw Wildflower Honey (500g)',
    brand: 'Midori',
    bullets: ['Unfiltered, unpasteurised', 'Single apiary', 'Crystallises naturally'],
    description: 'Raw wildflower honey from a single apiary in Vermont. Will crystallise — that’s a feature, not a flaw.',
    images: [ux('1587049352846-4a222e784505')],
    price: 1500,
    currency: 'USD',
    weightGrams: 540,
    ratingAvg: 4.7,
    ratingCount: 312,
    salesCount: 567,
  },
  {
    slug: 'midori-olive-oil',
    title: 'Single-Estate Olive Oil (500ml)',
    brand: 'Midori',
    bullets: ['Single-estate Cretan', 'Cold-pressed within 24h', 'Glass bottle'],
    description: 'Cold-pressed within 24 hours of harvest from a single grove on Crete. Peppery on the back of the throat — the way it should be.',
    images: [ux('1602256082884-ec1ab09bea30')],
    price: 2900,
    mrp: 3500,
    currency: 'USD',
    weightGrams: 720,
    ratingAvg: 4.6,
    ratingCount: 234,
    salesCount: 345,
  },
  {
    slug: 'midori-stone-milled-pasta',
    title: 'Bronze-Die Pasta Sampler',
    brand: 'Midori',
    bullets: ['4 x 500g', 'Bronze-die extruded', 'Holds sauce'],
    description: 'Four 500g packets of bronze-die pasta in shapes that actually hold sauce: spaghetti, rigatoni, casarecce, mezze maniche.',
    images: [ux('1551892374-ecf8754cf8b0')],
    price: 2400,
    currency: 'USD',
    weightGrams: 2100,
    ratingAvg: 4.5,
    ratingCount: 178,
    salesCount: 256,
  },
];

const SPORTS: DemoProduct[] = [
  {
    slug: 'lumen-pace-running-belt',
    title: 'Pace Reflective Running Belt',
    brand: 'Lumen',
    bullets: ['Holds phone + keys + gel', '360° reflective trim', 'Sweat-wicking liner'],
    description: 'A running belt that doesn’t bounce. Sweat-wicking liner, reflective trim, room for a phone, keys, and a gel.',
    images: [ux('1571019613454-1cb2f99b2d8b')],
    price: 2900,
    currency: 'USD',
    weightGrams: 90,
    ratingAvg: 4.4,
    ratingCount: 423,
    salesCount: 612,
  },
  {
    slug: 'kintsugi-yoga-mat',
    title: 'Natural Rubber Yoga Mat',
    brand: 'Kintsugi',
    bullets: ['5mm natural rubber', 'Non-slip wet or dry', 'Comes with carry strap'],
    description: 'A yoga mat that grips when your hands sweat. Pure natural rubber — no PVC, no microplastics.',
    images: [ux('1592477213056-3da6196dc9c8')],
    price: 8900,
    mrp: 11900,
    currency: 'USD',
    weightGrams: 2400,
    ratingAvg: 4.6,
    ratingCount: 678,
    salesCount: 921,
  },
  {
    slug: 'lumen-stainless-water-bottle',
    title: 'Stainless Insulated Bottle (1L)',
    brand: 'Lumen',
    bullets: ['Vacuum-insulated', 'Keeps cold 24h / hot 12h', 'Wide-mouth + narrow caps'],
    description: 'A 1L insulated bottle with two caps in the box. Wide-mouth for ice; narrow for sips that don’t get on your shirt.',
    images: [ux('1602143407151-7111542de6e8')],
    price: 3900,
    currency: 'USD',
    weightGrams: 460,
    ratingAvg: 4.7,
    ratingCount: 1342,
    salesCount: 2104,
  },
  {
    slug: 'kintsugi-resistance-bands',
    title: 'Cotton-Wrapped Resistance Bands',
    brand: 'Kintsugi',
    bullets: ['Set of 3', 'Cotton-wrapped, won’t roll', 'Carry pouch included'],
    description: 'Cotton-wrapped resistance bands that don’t roll up mid-set. Three resistance levels in a single carry pouch.',
    images: [ux('1599058917212-d750089bc07e')],
    price: 2900,
    currency: 'USD',
    weightGrams: 320,
    ratingAvg: 4.4,
    ratingCount: 312,
    salesCount: 489,
  },
  {
    slug: 'lumen-trail-headlamp',
    title: 'Trail Rechargeable Headlamp',
    brand: 'Lumen',
    bullets: ['400 lumens', '12h on low / 4h on high', 'IPX7 waterproof'],
    description: 'A headlamp tuned for trail running and night walks. Bright enough for technical terrain, light enough to forget you’re wearing it.',
    images: [ux('1604335079039-b4cdef0d40db')],
    price: 4900,
    mrp: 6500,
    currency: 'USD',
    weightGrams: 110,
    ratingAvg: 4.5,
    ratingCount: 287,
    salesCount: 412,
  },
  {
    slug: 'kintsugi-cork-yoga-block',
    title: 'Natural Cork Yoga Block',
    brand: 'Kintsugi',
    bullets: ['100% natural cork', 'Beveled edges', 'Sustainably harvested Portugal'],
    description: 'A cork block that grips, supports, and gets nicer with use. Sustainably harvested in Portugal.',
    images: [ux('1602143407151-7111542de6e8')],
    price: 1900,
    currency: 'USD',
    weightGrams: 380,
    ratingAvg: 4.4,
    ratingCount: 198,
    salesCount: 267,
  },
];

const CATALOG: CategoryDemo[] = [
  { slug: 'electronics', sellerSlug: 'lumen-electronics', products: ELECTRONICS },
  { slug: 'fashion', sellerSlug: 'kintsugi-home', products: FASHION },
  { slug: 'home', sellerSlug: 'kintsugi-home', products: HOME },
  { slug: 'beauty', sellerSlug: 'midori-beauty', products: BEAUTY },
  { slug: 'books', sellerSlug: 'fern-and-fable', products: BOOKS },
  { slug: 'toys', sellerSlug: 'fern-and-fable', products: TOYS },
  { slug: 'grocery', sellerSlug: 'midori-beauty', products: GROCERY },
  { slug: 'sports', sellerSlug: 'lumen-electronics', products: SPORTS },
];

async function ensureSeller(s: DemoSeller) {
  // Each demo seller has a parallel User row with no password — they'll never
  // sign in. Using `emailVerified: now()` keeps them out of unverified-user
  // sweeps if we add one later.
  const user = await prisma.user.upsert({
    where: { email: s.email },
    update: { fullName: s.legalName, emailVerified: new Date() },
    create: {
      email: s.email,
      fullName: s.legalName,
      emailVerified: new Date(),
      countryCode: s.countryCode,
      roles: ['BUYER', 'SELLER'],
    },
  });

  const seller = await prisma.seller.upsert({
    where: { slug: s.slug },
    update: {
      legalName: s.legalName,
      displayName: s.displayName,
      description: s.description,
      countryCode: s.countryCode,
      status: 'APPROVED',
      stripePayoutsEnabled: false,
      isDemo: true,
    },
    create: {
      userId: user.id,
      slug: s.slug,
      legalName: s.legalName,
      displayName: s.displayName,
      description: s.description,
      countryCode: s.countryCode,
      status: 'APPROVED',
      approvedAt: new Date(),
      isDemo: true,
    },
  });

  return seller;
}

async function ensureProduct(args: {
  sellerId: string;
  categoryId: string;
  countryCode: string;
  p: DemoProduct;
}) {
  const { sellerId, categoryId, countryCode, p } = args;

  const product = await prisma.product.upsert({
    where: { slug: p.slug },
    update: {
      title: p.title,
      brand: p.brand,
      description: p.description,
      bullets: p.bullets,
      images: p.images,
      categoryId,
      sellerId,
      status: 'ACTIVE',
      countryCode,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      salesCount: p.salesCount,
      publishedAt: new Date(),
    },
    create: {
      slug: p.slug,
      title: p.title,
      brand: p.brand,
      description: p.description,
      bullets: p.bullets,
      images: p.images,
      categoryId,
      sellerId,
      status: 'ACTIVE',
      countryCode,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      salesCount: p.salesCount,
      publishedAt: new Date(),
    },
  });

  // Recreate the single default variant so price/stock stay fresh on re-runs.
  await prisma.variant.deleteMany({ where: { productId: product.id } });
  await prisma.variant.create({
    data: {
      productId: product.id,
      sku: `${p.slug}-default`.slice(0, 64),
      title: 'Default',
      attributes: {},
      priceAmount: p.price,
      mrpAmount: p.mrp ?? null,
      currency: p.currency,
      stockQty: 100,
      reservedQty: 0,
      reorderPoint: 10,
      weightGrams: p.weightGrams,
      lengthMm: 200,
      widthMm: 150,
      heightMm: 80,
      isActive: true,
    },
  });

  return product;
}

async function reset() {
  // eslint-disable-next-line no-console
  console.log('🔄 resetting demo data…');
  const sellers = await prisma.seller.findMany({
    where: { isDemo: true },
    select: { id: true, userId: true },
  });
  const sellerIds = sellers.map((s) => s.id);
  const userIds = sellers.map((s) => s.userId);

  // Variants → Products → Seller → User. Cascades handle most of it; explicit
  // for clarity.
  const products = await prisma.product.findMany({
    where: { sellerId: { in: sellerIds } },
    select: { id: true },
  });
  const productIds = products.map((p) => p.id);
  await prisma.variant.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  // eslint-disable-next-line no-console
  console.log(`✔ removed ${sellers.length} demo sellers, ${products.length} products`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--reset')) {
    await reset();
    return;
  }

  // eslint-disable-next-line no-console
  console.log('🌱 seeding demo catalog…');

  const sellersBySlug = new Map<string, { id: string; countryCode: string }>();
  for (const s of SELLERS) {
    const seller = await ensureSeller(s);
    sellersBySlug.set(s.slug, { id: seller.id, countryCode: seller.countryCode });
    // eslint-disable-next-line no-console
    console.log(`  seller: ${s.displayName}`);
  }

  const categories = await prisma.category.findMany({
    where: { slug: { in: CATALOG.map((c) => c.slug) } },
    select: { id: true, slug: true },
  });
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  let total = 0;
  for (const cat of CATALOG) {
    const categoryId = categoryIdBySlug.get(cat.slug);
    if (!categoryId) {
      // eslint-disable-next-line no-console
      console.warn(`  skip: category ${cat.slug} not in DB — run \`pnpm db:seed\` first`);
      continue;
    }
    const seller = sellersBySlug.get(cat.sellerSlug);
    if (!seller) continue;

    for (const p of cat.products) {
      await ensureProduct({
        sellerId: seller.id,
        categoryId,
        countryCode: seller.countryCode,
        p,
      });
      total++;
    }
    // eslint-disable-next-line no-console
    console.log(`  ${cat.slug}: ${cat.products.length} products`);
  }

  // eslint-disable-next-line no-console
  console.log(`✓ seeded ${total} demo products across ${CATALOG.length} categories`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
