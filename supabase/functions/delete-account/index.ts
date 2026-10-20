// Kullanıcının kendi hesabını kalıcı olarak siler (mağaza kuralı: uygulama içinden silinebilmeli).
// Kimlik, isteğin Authorization başlığındaki oturum anahtarıyla Auth sunucusundan doğrulanır; gövde okunmaz.
// Silinenler: auth.users satırı → accounts, profiles (cascade); bildirim fotoğrafları (reports/<uid>/), profil fotoğrafı (avatars/<uid>/).
// Kalanlar: erişilebilirlik bildirimleri (user_id boşalır), rota onayları.
import { createClient } from 'npm:@supabase/supabase-js@2';

// Web (sezi.info) tarayıcıdan çağırır. Kimlik çerez değil Bearer anahtarı olduğu için her köken açık olabilir.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'unauthorized' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'unauthorized' });
  const uid = data.user.id;
  // Kullanıcının dosyaları: klasör boşalana kadar sayfa sayfa.
  for (const name of ['reports', 'avatars']) {
    const bucket = admin.storage.from(name);
    for (;;) {
      const listed = await bucket.list(uid, { limit: 100 });
      if (listed.error) {
        console.error('list', name, listed.error.message);
        return json(500, { error: 'storage' });
      }
      if (!listed.data.length) break;
      const removed = await bucket.remove(listed.data.map((o) => `${uid}/${o.name}`));
      if (removed.error) {
        console.error('remove', name, removed.error.message);
        return json(500, { error: 'storage' });
      }
    }
  }

  const deleted = await admin.auth.admin.deleteUser(uid);
  if (deleted.error) {
    console.error('delete', deleted.error.message);
    return json(500, { error: 'delete' });
  }
  return json(200, { ok: true });
});
