// Storage 버킷 및 정책 생성
// Supabase Management API 사용

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Storage 정책은 psql로 처리
const { Client } = require('pg');
const CONNECTION_STRING = process.env.DATABASE_URL || '';

async function setupStorage() {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  console.log('DB 연결 성공');

  // Storage 버킷 생성 (storage.buckets 테이블에 직접 삽입)
  console.log('\n[1/3] Storage 버킷 생성...');
  await client.query(`
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('gamja_02_images', 'gamja_02_images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
    ON CONFLICT (id) DO UPDATE SET
      public = true,
      file_size_limit = 10485760;
  `);
  console.log('  버킷 gamja_02_images 생성 완료 (public, 10MB 제한)');

  // Storage 정책 생성
  console.log('\n[2/3] Storage RLS 정책...');

  // SELECT: 누구나
  await client.query(`DROP POLICY IF EXISTS "gamja_02_images_select" ON storage.objects;`);
  await client.query(`
    CREATE POLICY "gamja_02_images_select" ON storage.objects
      FOR SELECT USING (bucket_id = 'gamja_02_images');
  `);

  // INSERT: 인증된 유저만
  await client.query(`DROP POLICY IF EXISTS "gamja_02_images_insert" ON storage.objects;`);
  await client.query(`
    CREATE POLICY "gamja_02_images_insert" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'gamja_02_images' AND
        auth.role() = 'authenticated'
      );
  `);

  // DELETE: 본인 폴더만 (경로: {user_id}/...)
  await client.query(`DROP POLICY IF EXISTS "gamja_02_images_delete" ON storage.objects;`);
  await client.query(`
    CREATE POLICY "gamja_02_images_delete" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'gamja_02_images' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  `);

  // UPDATE: 본인 폴더만
  await client.query(`DROP POLICY IF EXISTS "gamja_02_images_update" ON storage.objects;`);
  await client.query(`
    CREATE POLICY "gamja_02_images_update" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'gamja_02_images' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  `);

  console.log('  Storage 정책 완료');

  console.log('\n[3/3] 설정 확인...');
  const bucketCheck = await client.query(`SELECT id, name, public FROM storage.buckets WHERE id = 'gamja_02_images';`);
  console.log('  버킷:', bucketCheck.rows[0]);

  const policyCheck = await client.query(`
    SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname LIKE 'gamja_02%';
  `);
  console.log('  Storage 정책 목록:');
  policyCheck.rows.forEach(r => console.log('   -', r.policyname));

  console.log('\n========================================');
  console.log('Storage 설정 완료!');
  console.log('========================================');

  await client.end();
}

setupStorage().catch(err => {
  console.error('오류:', err.message);
  process.exit(1);
});
