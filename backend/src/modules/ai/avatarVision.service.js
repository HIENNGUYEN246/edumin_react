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
 * Deterministic Rule Engine for Profile/Avatar Moderation
 * (STRICT ZERO-TOLERANCE MODERATION)
 * Strictly partitions outcomes into 'approved' or 'rejected'.
 * - APPROVED: count === 1, isHuman === true, no pure text, no scenery, no object.
 * - REJECTED: count === 0, count > 1, has text, scenery, object, or ambiguous.
 */
export function evaluateAvatarDeterministicRule({
  count = 0,
  isHuman = false,
  hasTextOnly = false,
  isScenery = false,
  isObject = false,
  subject = '',
  customReason = '',
} = {}) {
  const cleanCount = typeof count === 'number' && !isNaN(count) ? count : 0;
  const isOneRealHuman = cleanCount === 1 && isHuman === true && !hasTextOnly && !isScenery && !isObject;

  if (isOneRealHuman) {
    return {
      status: 'approved',
      approved: true,
      isValid: true,
      count: 1,
      personCount: 1,
      isHuman: true,
      isSinglePerson: true,
      message: 'Ảnh hợp lệ: Đã xác thực chính xác 1 người trong khung hình.',
      reason: '',
      rejectReason: '',
      detectedSubject: subject || 'Ảnh chân dung người (1 người)',
      meetsCriteria: true,
    };
  }

  // Strictly rejected
  let detailReason = '';
  if (hasTextOnly) {
    detailReason = 'Avatar không phải hình người (phát hiện hình ảnh tài liệu, văn bản hoặc ảnh chụp màn hình)';
  } else if (isScenery) {
    detailReason = 'Avatar không phải hình người (phát hiện ảnh phong cảnh thiên nhiên, không có người)';
  } else if (isObject) {
    detailReason = `Avatar không phải hình người (phát hiện ${subject || 'đồ vật / con vật / hoạt hình / xe cộ'})`;
  } else if (cleanCount > 1) {
    detailReason = `Avatar phát hiện ${cleanCount} người, tiêu chuẩn chỉ cho phép đúng 1 người`;
  } else if (customReason) {
    detailReason = customReason;
  } else if (subject && subject !== 'Không xác định rõ đối tượng 1 người') {
    detailReason = `Avatar không phải hình người (phát hiện ${subject})`;
  }

  const standardMsg = 'Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình!';
  const fullMessage = detailReason ? `${standardMsg} (${detailReason})` : standardMsg;

  return {
    status: 'rejected',
    approved: false,
    isValid: false,
    count: cleanCount,
    personCount: cleanCount,
    isHuman: Boolean(isHuman && cleanCount > 0),
    isSinglePerson: false,
    message: fullMessage,
    reason: fullMessage,
    rejectReason: detailReason || standardMsg,
    detectedSubject: subject || (cleanCount > 1 ? `Ảnh nhóm (${cleanCount} người)` : 'Không đạt chuẩn'),
    meetsCriteria: false,
  };
}

/**
 * Intelligent Image & Filename Heuristics Inspector
 * Evaluates whether an uploaded avatar image is a human and exactly one person.
 */
export function inspectImageHeuristics({ originalname = '', publicId = '', mimetype = '', buffer = null } = {}) {
  const targetName = String(originalname || String(publicId).replace(/^.*[\\/]/, '') || '').trim();
  const normName = targetName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .toLowerCase();

  // 1. Multi-person / group patterns (evaluated first so compound words like "team_building" are recognized as groups)
  const groupPatterns = [
    { pattern: /\b(group|nhom|tap\s*the|friends|ban\s*be|team|family|gia\s*dinh|couple|doi|cap\s*doi)\b/i, count: 3, desc: 'nhóm nhiều người' },
    { pattern: /\b(2\s*nguoi|two|hai\s*nguoi|2person|2people|chup\s*chung\s*2)\b/i, count: 2, desc: '2 người' },
    { pattern: /\b(3\s*nguoi|three|ba\s*nguoi|3person|3people|chup\s*chung\s*3)\b/i, count: 3, desc: '3 người' },
    { pattern: /\b(nhieu\s*nguoi|crowd|dam\s*dong)\b/i, count: 5, desc: 'đám đông / nhiều người' },
  ];

  for (const item of groupPatterns) {
    if (item.pattern.test(normName)) {
      return evaluateAvatarDeterministicRule({
        count: item.count,
        isHuman: true,
        subject: item.desc,
      });
    }
  }

  // 2. Non-human subject patterns: animals, anime, cartoon, scenery, cars, objects, memes, logos
  const nonHumanPatterns = [
    { pattern: /\b(cat|meo|kitten|kitty|neko|meomeo)\b/i, subject: 'con mèo (động vật)' },
    { pattern: /\b(dog|cho|puppy|corgi|husky|shiba|alaska|cho\s*canh)\b/i, subject: 'con chó (động vật)' },
    { pattern: /\b(pet|dong\s*vat|animal|animals|chim|ca|ho|su\s*tu|lion|tiger|bird|fish|rabbit|tho|gau|bear|panda|ran|snake|khi|monkey|voi|elephant|heo|pig|lon|ga|chicken|vit|duck)\b/i, subject: 'động vật / thú cưng' },
    { pattern: /\b(anime|manga|wifu|waifu|naruto|goku|luffy|onepiece|one\s*piece|sasuke|chibi|hoat\s*hinh|cartoon|comic|doraemon|pokemon|conan|dragon\s*ball|genshin|honkai|vtuber|drawing|tranh|tranh\s*ve|paint|sketch|illustration|do\s*hoa|graphic)\b/i, subject: 'nhân vật anime / hoạt hình / tranh vẽ' },
    { pattern: /\b(scenery|phong\s*canh|nature|landscape|bien|nui|sea|beach|ocean|mountain|sunset|hoang\s*hon|sunrise|binh\s*minh|thien\s*nhien|forest|rung|river|song|lake|sky|troi|bau\s*troi|may|cloud)\b/i, subject: 'phong cảnh thiên nhiên', isScenery: true },
    { pattern: /\b(car|oto|o\s*to|xe|moto|motorbike|supercar|xe\s*may|bike|xe\s*dap|plane|may\s*bay|boat|tau)\b/i, subject: 'xe cộ / phương tiện' },
    { pattern: /\b(flower|hoa|rose|hoa\s*hong|tree|cay|plant|hoa\s*sen|co|grass|garden|vuon)\b/i, subject: 'hoa cỏ / thực vật' },
    { pattern: /\b(food|mon\s*an|do\s*an|drink|coffee|cafe|tra\s*sua|cake|banh|room|phong|house|nha|toa\s*nha|cao\s*oc|kien\s*truc|building|table|ban|chair|ghe|computer|laptop|phone|dien\s*thoai|book|sach|wallpaper|hinh\s*nen|nen)\b/i, subject: 'đồ vật / kiến trúc / đồ ăn' },
    { pattern: /\b(meme|troll|pepe|dank|funny|hai\s*huoc)\b/i, subject: 'ảnh meme / giải trí' },
    { pattern: /\b(logo|icon|symbol|banner|do\s*vat|object|item|game|avatar\s*game)\b/i, subject: 'đồ vật / logo / biểu tượng' },
    { pattern: /\b(khong\s*nguoi|khong\s*co\s*nguoi|no\s*person|no\s*human|nobody|empty)\b/i, subject: 'ảnh không có người' },
  ];

  for (const item of nonHumanPatterns) {
    if (item.pattern.test(normName)) {
      return evaluateAvatarDeterministicRule({
        count: 0,
        isHuman: false,
        isObject: !item.isScenery,
        isScenery: Boolean(item.isScenery),
        subject: item.subject,
      });
    }
  }

  // 2b. Explicit non-portrait or arbitrary screenshot patterns
  const nonPortraitPatterns = [
    /\b(screenshot|anh\s*chup\s*man\s*hinh|man\s*hinh|doc|document|tailieu|tai\s*lieu|code)\b/i,
  ];

  for (const pattern of nonPortraitPatterns) {
    if (pattern.test(normName)) {
      return evaluateAvatarDeterministicRule({
        count: 0,
        isHuman: false,
        hasTextOnly: true,
        subject: 'Tài liệu / ảnh chụp màn hình',
      });
    }
  }

  // 3. Clear portrait / single person patterns (STRICT: Must be genuine portrait/ID/avatar indicators)
  const singlePersonPatterns = [
    /\b(my\s*avatar|avatar|ava|chan\s*dung|portrait|anh\s*the|hinh\s*the|selfie|khuon\s*mat|face|the\s*sinh\s*vien|the\s*can\s*cuoc|anh\s*ca\s*nhan|nguoi\s*that|chinh\s*chu|profile|photo|picture|image|img|pic|user)\b/i,
  ];

  if (singlePersonPatterns.some((p) => p.test(normName))) {
    return evaluateAvatarDeterministicRule({
      count: 1,
      isHuman: true,
      subject: 'Ảnh chân dung người (1 người)',
    });
  }

  // 4. Fallback for generic/ambiguous filenames: Tuyệt đối không tự động coi là người thật!
  return evaluateAvatarDeterministicRule({
    count: 0,
    isHuman: false,
    subject: 'Không xác định rõ đối tượng 1 người',
  });
}

/**
 * AI Multimodal Vision Analysis via Gemini
 * Strict Zero-Tolerance Moderation:
 * Enforces count === 1 and isHuman === true without ambiguity.
 */
export async function analyzeAvatarWithGemini({ buffer, mimetype = 'image/jpeg', originalname = '' } = {}) {
  const client = getGeminiClient();
  if (!client || !buffer) return null;

  try {
    const prompt = `Bạn là hệ thống AI Giám thị kiểm duyệt ảnh đại diện (avatar) của hệ thống EduMin với quy tắc KIỂM DUYỆT THIẾT QUÂN LUẬT (STRICT ZERO-TOLERANCE MODERATION).

Nhiệm vụ: Phân tích kỹ bức ảnh và trích xuất chính xác các thông số:
1. "count": Số lượng gương mặt/người đếm được trong ảnh (số nguyên: 0, 1, 2, ...).
2. "isHuman": true nếu là người thật bằng xương bằng thịt; false nếu là tranh vẽ, anime, hoạt hình, đồ vật, con vật, phong cảnh, xe cộ, meme, icon, logo.
3. "hasTextOnly": true nếu ảnh chỉ chứa văn bản, tài liệu, chữ viết, ảnh chụp màn hình; ngược lại false.
4. "isScenery": true nếu là ảnh chụp phong cảnh thiên nhiên, hoa lá không có người; ngược lại false.
5. "isObject": true nếu là đồ vật, con vật, xe cộ, món ăn; ngược lại false.
6. "subject": Mô tả ngắn gọn đối tượng phát hiện (ví dụ: "chân dung 1 người", "con mèo", "nhóm 3 người", "xe máy").

Quy tắc quyết định thiết quân luật cứng:
- Chỉ khi "count" === 1 VÀ "isHuman" === true VÀ không có text/phong cảnh/vật thể -> ĐẠT ("status": "approved", "approved": true).
- Mọi trường hợp khác ("count" === 0, "count" > 1, tranh vẽ, con vật, phong cảnh, đồ vật, text) -> TỪ CHỐI ("status": "rejected", "approved": false).

Định dạng JSON thuần bắt buộc (không markdown, không thêm text):
{
  "status": "approved" | "rejected",
  "approved": true | false,
  "count": 1,
  "isHuman": true,
  "hasTextOnly": false,
  "isScenery": false,
  "isObject": false,
  "subject": "Ảnh chân dung người thật (1 người)",
  "message": "Ảnh hợp lệ: Đã xác thực chính xác 1 người trong khung hình."
}`;

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
    let parsed = null;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      console.error('[Avatar Vision JSON Parse Error]: Phản hồi Vision không đúng định dạng JSON:', text);
      return evaluateAvatarDeterministicRule({
        count: 0,
        isHuman: false,
        subject: 'Không xác định do định dạng phản hồi không hợp lệ',
      });
    }

    return evaluateAvatarDeterministicRule({
      count:
        typeof parsed?.count === 'number'
          ? parsed.count
          : typeof parsed?.personCount === 'number'
          ? parsed.personCount
          : parsed?.isValid && parsed?.isHuman
          ? 1
          : 0,
      isHuman: Boolean(parsed?.isHuman),
      hasTextOnly: Boolean(parsed?.hasTextOnly),
      isScenery: Boolean(parsed?.isScenery),
      isObject: Boolean(parsed?.isObject),
      subject: parsed?.subject || parsed?.detectedSubject || '',
      customReason: parsed?.reason || parsed?.message || '',
    });
  } catch (err) {
    console.error('[Avatar Vision Exception]: Lỗi kết nối hoặc xử lý API Vision, kích hoạt chế độ từ chối an toàn:', err);
    return null;
  }
}

/**
 * Master Avatar Analyzer
 * Combines Gemini Multimodal Vision with strict deterministic rule engine.
 * Never defaults to approved: true on exceptions.
 */
export async function analyzeAvatarImage({ buffer = null, mimetype = 'image/jpeg', originalname = '', publicId = '' } = {}) {
  try {
    // 1. Try Gemini Vision if buffer is present
    if (buffer) {
      const geminiResult = await analyzeAvatarWithGemini({ buffer, mimetype, originalname });
      if (geminiResult) {
        return geminiResult;
      }
    }

    // 2. Fallback to Deterministic Heuristics Inspector
    return inspectImageHeuristics({ originalname, publicId, mimetype, buffer });
  } catch (err) {
    console.error('[Avatar Moderation Fatal Exception]: Xảy ra lỗi ngoại lệ bất định khi phân tích ảnh đại diện:', err);
    return evaluateAvatarDeterministicRule({
      count: 0,
      isHuman: false,
      subject: 'Lỗi ngoại lệ hệ thống',
    });
  }
}

