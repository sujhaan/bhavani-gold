// ============================================================
//  SHOP SETTINGS — edit these values, then rebuild/republish.
// ============================================================
export const SITE = {
  shopName: 'Bhavani Gold',
  tagline: 'Gold bullion & custom jewellery · Vijayawada',
  whatsapp: '917780431116',
  whatsappDisplay: '+91 77804 31116',
  address: 'Jenda Street, near Raj Silver Palace, Vijayawada, Andhra Pradesh',
  landmark: 'Opposite Leela Casting',
  mapsUrl: 'https://share.google/yxWZ1uRgQzttJOJA1',
  email: 'bhavanigold24k@gmail.com',
  instagram: '', // e.g. 'bhavanigold' — shows an Instagram link in the footer when set
  /** Leave empty until you confirm the hours; nothing is shown while empty. Example: 'Mon–Sat 10 am – 9 pm' */
  hours: '',
  since: 'About 30 years',

  /**
   * EASIEST WAY TO UPDATE RATES DAILY: a Google Sheet.
   * 1. Make a sheet with two columns, e.g.   gold24 | 7845   /   gold22 | 7190   /   silver | 96   /   updated | 20 Nov, 10:30 AM
   * 2. File → Share → Publish to web → choose the sheet → "Comma-separated values (.csv)" → Publish → copy the link.
   * 3. Paste the link below. Every visitor then sees the numbers you type in the sheet (refreshes within ~5 minutes).
   * Leave empty to use the fixed values below.
   */
  ratesSheetCsv: '',

  /**
   * Today's rates in ₹ per gram. Leave as null to show "Ask on WhatsApp" instead of a number.
   * Never put an old rate here — update it each day or leave it null.
   */
  rates: {
    gold24: null as number | null, // 24K 999
    gold22: null as number | null, // 22K 916
    silver: null as number | null, // Silver 999
    updatedAt: '' as string, // e.g. '17 Nov 2026, 10:30 AM'
  },
};

/**
 * Real product photos: put your own photo in public/photos/ (e.g. bullion-10g.jpg) and set `photo: 'bullion-10g'`.
 * Cards without a photo show a clean text card — never a drawing or a stock image.
 */
export type Bullion = { id: string; kind: 'Biscuit' | 'Coin' | 'Bar'; grams: number; purity: '24K (999)' | '22K (916)'; note?: string; photo?: string };
export const BULLION: Bullion[] = [
  { id: 'c1', kind: 'Coin', grams: 1, purity: '24K (999)' },
  { id: 'c2', kind: 'Coin', grams: 2, purity: '24K (999)' },
  { id: 'c5', kind: 'Coin', grams: 5, purity: '24K (999)' },
  { id: 'b10', kind: 'Biscuit', grams: 10, purity: '24K (999)', photo: 'proto-b10' },
  { id: 'b20', kind: 'Biscuit', grams: 20, purity: '24K (999)', photo: 'proto-b20' },
  { id: 'b50', kind: 'Biscuit', grams: 50, purity: '24K (999)', photo: 'proto-b50' },
  { id: 'b100', kind: 'Biscuit', grams: 100, purity: '24K (999)', photo: 'real-b100' },
];

export type GalleryCat = 'Necklaces' | 'Earrings' | 'Pendants' | 'Chains' | 'Bangles' | 'Rings' | 'Sets' | 'Custom';
export const GALLERY: { id: string; cat: GalleryCat; title: string }[] = [
  { id: 'real-chandbali', cat: 'Earrings', title: 'Lakshmi chandbalis with ruby & emerald' },
  { id: 'p124', cat: 'Necklaces', title: 'Three-line emerald necklace' },
  { id: 'p100', cat: 'Necklaces', title: 'Mango haram, ruby kemp' },
  { id: 'p129', cat: 'Necklaces', title: 'Lakshmi long haram' },
  { id: 'p109', cat: 'Earrings', title: 'Stone-set drop earrings' },
  { id: 'p105', cat: 'Earrings', title: 'Filigree chandelier earrings' },
  { id: 'px-chandbali', cat: 'Earrings', title: 'Chandbalis with green beads' },
  { id: 'p092', cat: 'Pendants', title: 'Pearl drop pendant' },
  { id: 'px-pendant', cat: 'Pendants', title: 'Sun pendant with ruby drop' },
  { id: 'px-choker-set', cat: 'Sets', title: 'Bridal choker set' },
  { id: 'px-bridal-set', cat: 'Sets', title: 'Wedding set with long haram' },
];
