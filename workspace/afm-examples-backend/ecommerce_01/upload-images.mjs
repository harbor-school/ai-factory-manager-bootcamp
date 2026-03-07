/**
 * upload-images.mjs
 *
 * Supabase Storage에 상품 이미지 15개를 업로드하는 스크립트.
 * server.js를 수정하지 않고 독립적으로 실행한다.
 *
 * 사용법:
 *   SUPABASE_SERVICE_KEY=<service-role-key> node upload-images.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ───────────────────────────────────────────────────────────────
const SUPABASE_PROJECT_ID = 'xwzcqjyjblsoatcohojl';
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const STORAGE_BUCKET = 'ecommerce-products';

const IMAGES_DIR = join(__dirname, 'images');

const IMAGE_FILES = [
  '01-damascus-chef-knife.png',
  '02-santoku-knife.png',
  '03-bread-knife.png',
  '04-acacia-board.png',
  '05-bamboo-board-set.png',
  '06-cast-iron-pot.png',
  '07-stainless-saucepan.png',
  '08-nonstick-pan.png',
  '09-enamel-dutch-oven.png',
  '10-copper-skillet.png',
  '11-olive-spatula-set.png',
  '12-measuring-cups.png',
  '13-silicone-tongs.png',
  '14-ceramic-spice-jars.png',
  '15-linen-apron.png',
];

// ─── Validation ───────────────────────────────────────────────────────────
if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY 환경변수가 필요합니다.');
  console.error('');
  console.error('실행 방법:');
  console.error('  SUPABASE_SERVICE_KEY=<your-service-role-key> node upload-images.mjs');
  console.error('');
  console.error('Service Role Key 확인 위치:');
  console.error('  https://supabase.com/dashboard/project/xwzcqjyjblsoatcohojl/settings/api');
  console.error('  → "Project API keys" 섹션 → "service_role" 키');
  process.exit(1);
}

// ─── Supabase Storage Helpers ─────────────────────────────────────────────

const headers = {
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'apikey': SUPABASE_SERVICE_KEY,
};

async function ensureBucket() {
  console.log(`버킷 확인 중: ${STORAGE_BUCKET}`);

  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${STORAGE_BUCKET}`, { headers });

  if (!res.ok) {
    // Supabase는 버킷 없을 때 404가 아닌 400을 반환할 수 있음 → !res.ok 체크
    console.log(`버킷이 없습니다. 생성 중...`);

    const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: STORAGE_BUCKET,
        name: STORAGE_BUCKET,
        public: true,
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`버킷 생성 실패: ${createRes.status} ${errText}`);
    }

    console.log(`버킷 생성 완료: ${STORAGE_BUCKET}`);
  } else {
    console.log(`버킷 확인 완료: ${STORAGE_BUCKET} (이미 존재)`);
  }
}

async function uploadImage(filename) {
  const filepath = join(IMAGES_DIR, filename);
  const buffer = readFileSync(filepath);

  // 이미 업로드된 파일은 upsert 방식으로 덮어씀 (x-upsert: true)
  const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${filename}`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: buffer,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`업로드 실패 (${filename}): ${uploadRes.status} ${errText}`);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${filename}`;
  return publicUrl;
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('Supabase Storage 이미지 업로드 스크립트');
  console.log(`프로젝트: ${SUPABASE_URL}`);
  console.log(`버킷: ${STORAGE_BUCKET}`);
  console.log('='.repeat(60));
  console.log('');

  // 1. 버킷 생성 (없을 경우)
  await ensureBucket();
  console.log('');

  // 2. 이미지 업로드
  console.log(`총 ${IMAGE_FILES.length}개 이미지 업로드 시작...`);
  console.log('');

  const results = [];
  const errors = [];

  for (let i = 0; i < IMAGE_FILES.length; i++) {
    const filename = IMAGE_FILES[i];
    const idx = String(i + 1).padStart(2, '0');

    try {
      const url = await uploadImage(filename);
      results.push({ filename, url });
      console.log(`[${idx}/${IMAGE_FILES.length}] OK  ${filename}`);
    } catch (err) {
      errors.push({ filename, error: err.message });
      console.error(`[${idx}/${IMAGE_FILES.length}] ERR ${filename}: ${err.message}`);
    }
  }

  // 3. 결과 출력
  console.log('');
  console.log('='.repeat(60));
  console.log(`업로드 완료: ${results.length}개 성공 / ${errors.length}개 실패`);
  console.log('='.repeat(60));
  console.log('');

  if (results.length > 0) {
    console.log('[ Public URL 목록 ]');
    console.log('');
    results.forEach(({ filename, url }) => {
      console.log(`${filename}`);
      console.log(`  ${url}`);
    });
    console.log('');

    // DB 업데이트용 SQL도 함께 출력
    console.log('='.repeat(60));
    console.log('[ DB image_url 업데이트 SQL ]');
    console.log('');
    console.log('-- 아래 SQL을 Supabase SQL Editor에서 실행하면');
    console.log('-- 상품 image_url이 Supabase Storage URL로 교체됩니다.');
    console.log('');
    console.log('UPDATE ecommerce_01_products SET image_url = CASE');

    const nameMap = [
      ['01-damascus-chef-knife.png', '다마스커스 셰프 나이프'],
      ['02-santoku-knife.png', '산토쿠 나이프'],
      ['03-bread-knife.png', '빵 나이프 (세레이티드)'],
      ['04-acacia-board.png', '아카시아 원목 도마'],
      ['05-bamboo-board-set.png', '대나무 도마 3종 세트'],
      ['06-cast-iron-pot.png', '무쇠 주물 냄비 22cm'],
      ['07-stainless-saucepan.png', '스테인리스 소스팬 18cm'],
      ['08-nonstick-pan.png', '논스틱 프라이팬 28cm'],
      ['09-enamel-dutch-oven.png', '에나멜 더치오븐'],
      ['10-copper-skillet.png', '구리 바닥 스킬렛'],
      ['11-olive-spatula-set.png', '올리브우드 주걱 세트'],
      ['12-measuring-cups.png', '스테인리스 계량컵 세트'],
      ['13-silicone-tongs.png', '실리콘 주방 집게'],
      ['14-ceramic-spice-jars.png', '세라믹 양념통 4종 세트'],
      ['15-linen-apron.png', '린넨 앞치마'],
    ];

    results.forEach(({ filename, url }) => {
      const entry = nameMap.find(([f]) => f === filename);
      if (entry) {
        const [, productName] = entry;
        console.log(`  WHEN name = '${productName}' THEN '${url}'`);
      }
    });

    console.log('END');
    console.log('WHERE name IN (');
    const uploadedNames = results
      .map(({ filename }) => {
        const entry = nameMap.find(([f]) => f === filename);
        return entry ? `  '${entry[1]}'` : null;
      })
      .filter(Boolean);
    console.log(uploadedNames.join(',\n'));
    console.log(');');
  }

  if (errors.length > 0) {
    console.log('');
    console.log('[ 실패 목록 ]');
    errors.forEach(({ filename, error }) => {
      console.error(`  ${filename}: ${error}`);
    });
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
