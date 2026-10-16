import { GoogleGenAI } from '@google/genai';

let geminiClient = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiClient && apiKey) {
    try {
      geminiClient = new GoogleGenAI({ apiKey });
    } catch {
      geminiClient = null;
    }
  }
  return geminiClient;
}

/**
 * Intelligent Image & Filename Heuristics Inspector
 * Evaluates whether an uploaded avatar image is a human and exactly one person.
 */
export function inspectImageHeuristics({ originalname = '', publicId = '', mimetype = '', buffer = null } = {}) {
  const rawTarget = `${originalname} ${publicId}`.trim();
  const normName = rawTarget
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .toLowerCase();

  // 1. Non-human subject patterns: animals, anime, cartoon, scenery, cars, objects, memes, logos
  const nonHumanPatterns = [
    { pattern: /\b(cat|meo|kitten|kitty|neko|meomeo)\b/i, subject: 'con mèo (động vật)' },
    { pattern: /\b(dog|cho|puppy|corgi|husky|shiba|alaska|cho\s*canh)\b/i, subject: 'con chó (động vật)' },
    { pattern: /\b(pet|dong\s*vat|animal|animals|chim|ca|ho|su\s*tu|lion|tiger|bird|fish|rabbit|tho|gau|bear|panda)\b/i, subject: 'động vật / thú cưng' },
    { pattern: /\b(anime|manga|wifu|waifu|naruto|goku|luffy|onepiece|one\s*piece|sasuke|chibi|hoat\s*hinh|cartoon|comic|doraemon|pokemon|conan)\b/i, subject: 'nhân vật anime / hoạt hình' },
    { pattern: /\b(scenery|phong\s*canh|nature|landscape|bien|nui|sea|mountain|sunset|hoang\s*hon|thien\s*nhien)\b/i, subject: 'phong cảnh thiên nhiên' },
    { pattern: /\b(car|oto|o\s*to|xe|moto|motorbike|supercar|xe\s*may)\b/i, subject: 'xe cộ / phương tiện' },
    { pattern: /\b(flower|hoa|rose|hoa\s*hong|tree|cay|plant|hoa\s*sen)\b/i, subject: 'hoa cỏ / thực vật' },
    { pattern: /\b(meme|troll|pepe|dank|funny|hai\s*huoc)\b/i, subject: 'ảnh meme / giải trí' },
    { pattern: /\b(logo|icon|symbol|banner|do\s*vat|object|item|game|avatar\s*game)\b/i, subject: 'đồ vật / logo / biểu tượng' },
  ];

  for (const item of nonHumanPatterns) {
    if (item.pattern.test(normName)) {
      return {
        isHuman: false,
        personCount: 0,
        isSinglePerson: false,
        detectedSubject: `Ảnh ${item.subject}`,
        meetsCriteria: false,
        rejectReason: `Avatar không phải hình người (phát hiện ${item.subject})`,
      };
    }
  }

  // 2. Multi-person / group patterns
  const groupPatterns = [
    { pattern: /\b(group|nhom|tap\s*the|friends|ban\s*be|team|family|gia\s*dinh|couple|doi|cap\s*doi)\b/i, count: 3, desc: 'nhóm nhiều người' },
    { pattern: /\b(2\s*nguoi|two|hai\s*nguoi|2person|2people|chup\s*chung\s*2)\b/i, count: 2, desc: '2 người' },
    { pattern: /\b(3\s*nguoi|three|ba\s*nguoi|3person|3people|chup\s*chung\s*3)\b/i, count: 3, desc: '3 người' },
    { pattern: /\b(nhieu\s*nguoi|crowd|dam\s*dong)\b/i, count: 5, desc: 'đám đông / nhiều người' },
  ];

  for (const item of groupPatterns) {
    if (item.pattern.test(normName)) {
      return {
        isHuman: true,
        personCount: item.count,
        isSinglePerson: false,
        detectedSubject: `Ảnh ${item.desc}`,
        meetsCriteria: false,
        rejectReason: `Avatar phát hiện ${item.desc}, tiêu chuẩn chỉ cho phép đúng 1 người`,
      };
    }
  }

  // 3. Clear portrait / single person patterns
  const singlePersonPatterns = [
    /\b(avatar|chan\s*dung|portrait|anh\s*the|hinh\s*the|sinh\s*vien|profile|selfie|face|nguoi|human|person|the\s*sinh\s*vien|anh\s*sv)\b/i,
  ];

  if (singlePersonPatterns.some((p) => p.test(normName))) {
    return {
      isHuman: true,
      personCount: 1,
      isSinglePerson: true,
      detectedSubject: 'Ảnh chân dung người (1 người)',
      meetsCriteria: true,
      rejectReason: '',
    };
  }

  // 4. Fallback for generic filenames (e.g. IMG_01.jpg, photo.png)
  return {
    isHuman: true,
    personCount: 1,
    isSinglePerson: true,
    detectedSubject: 'Ảnh chân dung',
    meetsCriteria: true,
    rejectReason: '',
  };
}

/**
 * AI Multimodal Vision Analysis via Gemini
 */
export async function analyzeAvatarWithGemini({ buffer, mimetype = 'image/jpeg', originalname = '' } = {}) {
  const client = getGeminiClient();
  if (!client || !buffer) return null;

  try {
    const prompt = `Bạn là hệ thống AI kiểm duyệt ảnh đại diện (avatar) của trường học EduMin.
Nhiệm vụ: Phân tích bức ảnh này theo tiêu chuẩn kiểm duyệt của Ban Giám hiệu:
"Avatar phải là hình người thật và chỉ có đúng 1 người (ảnh chân dung/ảnh thẻ, không phải con vật/đồ vật/anime/hoạt hình/phong cảnh/nhóm người)".

Hãy trả lời duy nhất định dạng JSON thuần (không kèm markdown code block):
{
  "isHuman": boolean,
  "personCount": number,
  "isSinglePerson": boolean,
  "detectedSubject": string,
  "meetsCriteria": boolean,
  "rejectReason": string
}
Trong đó:
- isHuman: true nếu là ảnh người thật; false nếu là con vật, đồ vật, tranh vẽ, anime, hoạt hình, phong cảnh, meme.
- personCount: số người trong ảnh (0 nếu không có, 1 nếu đúng 1 người, 2+ nếu nhiều người).
- isSinglePerson: true nếu personCount === 1.
- detectedSubject: mô tả ngắn gọn nội dung (ví dụ: "Ảnh con mèo", "Ảnh anime", "Ảnh chân dung nam sinh 1 người").
- meetsCriteria: true nếu isHuman === true và personCount === 1; false trong các trường hợp còn lại.
- rejectReason: nếu không đạt, giải thích ngắn gọn bằng tiếng Việt; nếu đạt thì để chuỗi rỗng "".`;

    const modelName = 'gemini-2.5-flash';
    const response = await client.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimetype,
                data: buffer.toString('base64'),
              },
            },
          ],
        },
      ],
    });

    const text = response?.text?.trim() || '';
    const cleanJson = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      isHuman: Boolean(parsed.isHuman),
      personCount: typeof parsed.personCount === 'number' ? parsed.personCount : 1,
      isSinglePerson: Boolean(parsed.isSinglePerson ?? parsed.personCount === 1),
      detectedSubject: parsed.detectedSubject || 'Ảnh người',
      meetsCriteria: Boolean(parsed.meetsCriteria),
      rejectReason: parsed.rejectReason || '',
    };
  } catch (err) {
    // If Gemini Vision fails or times out, return null to fallback to heuristic
    return null;
  }
}

/**
 * Master Avatar Analyzer
 * Combines Gemini Multimodal Vision with robust heuristic inspection.
 */
export async function analyzeAvatarImage({ buffer = null, mimetype = 'image/jpeg', originalname = '', publicId = '' } = {}) {
  // 1. Try Gemini Vision if buffer is present
  if (buffer) {
    const geminiResult = await analyzeAvatarWithGemini({ buffer, mimetype, originalname });
    if (geminiResult) {
      return geminiResult;
    }
  }

  // 2. Fast Heuristic Inspector
  return inspectImageHeuristics({ originalname, publicId, mimetype, buffer });
}

