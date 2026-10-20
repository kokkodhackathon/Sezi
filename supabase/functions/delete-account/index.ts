// Kullanıcının kendi hesabını kalıcı olarak siler (mağaza kuralı: uygulama içinden silinebilmeli).
// Kimlik, isteğin Authorization başlığındaki oturum anahtarıyla Auth sunucusundan doğrulanır; gövde okunmaz.
// Silinenler: auth.users satırı → accounts (cascade); bildirim fotoğrafları (reports/<uid>/).
// Kalanlar: erişilebilirlik bildirimleri (user_id boşalır), rota onayları.
import { createClient } from 'npm:@supabase/supabase-js@2';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'unauthorized' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'unauthorized' });
  const uid = data.user.id;

  // Bildirim fotoğrafları: klasör boşalana kadar sayfa sayfa.
  const bucket = admin.storage.from('reports');
  for (;;) {
    const listed = await bucket.list(uid, { limit: 100 });
    if (listed.error) {
      console.error('list', listed.error.message);
      return json(500, { error: 'storage' });
    }
    if (!listed.data.length) break;
    const removed = await bucket.remove(listed.data.map((o) => `${uid}/${o.name}`));
    if (removed.error) {
      console.error('remove', removed.error.message);
      return json(500, { error: 'storage' });
    }
  }

  const deleted = await admin.auth.admin.deleteUser(uid);
  if (deleted.error) {
    console.error('delete', deleted.error.message);
    return json(500, { error: 'delete' });
  }
  return json(200, { ok: true });
});
