const { Client } = require('pg');

const CONNECTION_STRING = process.env.DATABASE_URL || '';

async function setup() {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  console.log('DB 연결 성공');

  // ========================================
  // 1. 테이블 생성
  // ========================================
  console.log('\n[1/5] 테이블 생성...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS gamja_02_profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      nickname VARCHAR(100) NOT NULL,
      profile_image TEXT,
      manner_temp DECIMAL(3,1) DEFAULT 36.5,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      location_name VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('  gamja_02_profiles 생성 완료');

  await client.query(`
    CREATE TABLE IF NOT EXISTS gamja_02_products (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES gamja_02_profiles(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      price INTEGER DEFAULT 0,
      price_suggestion BOOLEAN DEFAULT false,
      is_free BOOLEAN DEFAULT false,
      category VARCHAR(100),
      status VARCHAR(20) DEFAULT '판매중',
      images JSONB DEFAULT '[]',
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      location_name VARCHAR(255),
      view_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('  gamja_02_products 생성 완료');

  // ========================================
  // 2. RLS 활성화
  // ========================================
  console.log('\n[2/5] RLS 활성화...');
  await client.query(`ALTER TABLE gamja_02_profiles ENABLE ROW LEVEL SECURITY;`);
  await client.query(`ALTER TABLE gamja_02_products ENABLE ROW LEVEL SECURITY;`);
  console.log('  RLS 활성화 완료');

  // ========================================
  // 3. gamja_02_profiles RLS 정책
  // ========================================
  console.log('\n[3/5] gamja_02_profiles RLS 정책...');

  await client.query(`DROP POLICY IF EXISTS "profiles_select_all" ON gamja_02_profiles;`);
  await client.query(`
    CREATE POLICY "profiles_select_all" ON gamja_02_profiles
      FOR SELECT USING (true);
  `);

  await client.query(`DROP POLICY IF EXISTS "profiles_insert_own" ON gamja_02_profiles;`);
  await client.query(`
    CREATE POLICY "profiles_insert_own" ON gamja_02_profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
  `);

  await client.query(`DROP POLICY IF EXISTS "profiles_update_own" ON gamja_02_profiles;`);
  await client.query(`
    CREATE POLICY "profiles_update_own" ON gamja_02_profiles
      FOR UPDATE USING (auth.uid() = id);
  `);

  console.log('  profiles 정책 완료');

  // ========================================
  // 4. gamja_02_products RLS 정책
  // ========================================
  console.log('\n[4/5] gamja_02_products RLS 정책...');

  await client.query(`DROP POLICY IF EXISTS "products_select_all" ON gamja_02_products;`);
  await client.query(`
    CREATE POLICY "products_select_all" ON gamja_02_products
      FOR SELECT USING (true);
  `);

  await client.query(`DROP POLICY IF EXISTS "products_insert_own" ON gamja_02_products;`);
  await client.query(`
    CREATE POLICY "products_insert_own" ON gamja_02_products
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  `);

  await client.query(`DROP POLICY IF EXISTS "products_update_own" ON gamja_02_products;`);
  await client.query(`
    CREATE POLICY "products_update_own" ON gamja_02_products
      FOR UPDATE USING (auth.uid() = user_id);
  `);

  await client.query(`DROP POLICY IF EXISTS "products_delete_own" ON gamja_02_products;`);
  await client.query(`
    CREATE POLICY "products_delete_own" ON gamja_02_products
      FOR DELETE USING (auth.uid() = user_id);
  `);

  console.log('  products 정책 완료');

  // ========================================
  // 5. Storage 버킷 생성 (Supabase REST API)
  // ========================================
  // Storage는 REST API로만 생성 가능하므로 여기서는 안내만
  console.log('\n[5/5] Storage 버킷은 Supabase Dashboard에서 직접 생성하거나 아래 스크립트로 실행하세요');

  console.log('\n========================================');
  console.log('DB 설정 완료!');
  console.log('========================================');

  await client.end();
}

setup().catch(err => {
  console.error('오류:', err.message);
  process.exit(1);
});
