// Yönetici kullanıcılarını listeler, topluluk istatistiklerini toplar ve hesap işlemlerini yürütür. Service role yalnızca Edge Function'da tutulur; tarayıcıdan ayrıcalıklı Auth işlemi yapılamaz.
import { createClient, type User } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const BodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }).strict(),
  z.object({ action: z.literal('stats') }).strict(),
  z.object({ action: z.literal('set_role'), user_id: z.string().uuid(), admin: z.boolean() }).strict(),
  z.object({ action: z.literal('ban'), user_id: z.string().uuid(), banned: z.boolean() }).strict(),
  z.object({ action: z.literal('delete'), user_id: z.string().uuid() }).strict(),
]);

const StatsProfileSchema = z.object({ visibility: z.enum(['private', 'friends', 'public']) });
const StatsVisitSchema = z.object({ work_slug: z.string(), method: z.enum(['route', 'checkin']), first_at: z.string() });
const StatsPhotoSchema = z.object({ review: z.enum(['pending', 'approved', 'rejected', 'none']), archive: z.string() });
const StatsReportSchema = z.object({ status: z.enum(['pending', 'approved', 'rejected']) });
const StatsFriendshipSchema = z.object({ status: z.enum(['pending', 'accepted']) });
const DailyCountSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), count: z.number().int().nonnegative() });
const StatsSchema = z.object({
  users: z.object({
    total: z.number().int().nonnegative(), admins: z.number().int().nonnegative(), banned: z.number().int().nonnegative(),
    new_7d: z.number().int().nonnegative(), new_30d: z.number().int().nonnegative(), active_7d: z.number().int().nonnegative(),
    with_profile: z.number().int().nonnegative(),
    visibility: z.object({ private: z.number().int().nonnegative(), friends: z.number().int().nonnegative(), public: z.number().int().nonnegative() }),
  }),
  signups_by_day: z.array(DailyCountSchema),
  visits: z.object({
    total: z.number().int().nonnegative(), last_30d: z.number().int().nonnegative(),
    by_method: z.object({ route: z.number().int().nonnegative(), checkin: z.number().int().nonnegative() }),
    by_day: z.array(DailyCountSchema),
    top_works: z.array(z.object({ work_slug: z.string(), count: z.number().int().positive() }).strict()).max(5),
  }),
  photos: z.object({
    by_review: z.object({ pending: z.number().int().nonnegative(), approved: z.number().int().nonnegative(), rejected: z.number().int().nonnegative(), none: z.number().int().nonnegative() }),
    archive_suggested: z.number().int().nonnegative(),
  }),
  reports: z.object({ by_status: z.object({ pending: z.number().int().nonnegative(), approved: z.number().int().nonnegative(), rejected: z.number().int().nonnegative() }) }),
  friendships: z.object({ accepted: z.number().int().nonnegative(), pending: z.number().int().nonnegative() }),
}).strict();

const StatsUsersPageSchema = z.object({
  id: z.string().uuid(), created_at: z.string(), last_sign_in_at: z.string().nullable(),
  app_metadata: z.record(z.unknown()).optional(), banned_until: z.string().nullable().optional(),
});
type StatsUser = z.infer<typeof StatsUsersPageSchema>;

const ProfileRowSchema = z.object({ user_id: z.string().uuid(), display_name: z.string(), username: z.string().nullable(), avatar_path: z.string().nullable() });
const VisitRowSchema = z.object({ user_id: z.string().uuid(), work_slug: z.string(), method: z.string(), first_at: z.string() });
const PhotoRowSchema = z.object({ user_id: z.string().uuid(), review: z.string() });
const ReportRowSchema = z.object({ user_id: z.string().uuid(), status: z.string() });
const ContributionRowSchema = z.object({ user_id: z.string().uuid(), reports_approved: z.number(), photos_public: z.number(), photos_archived: z.number(), friends: z.number() });
type Profile = z.infer<typeof ProfileRowSchema>;
type Visit = z.infer<typeof VisitRowSchema>;
type Photo = z.infer<typeof PhotoRowSchema>;
type Report = z.infer<typeof ReportRowSchema>;
type Contribution = z.infer<typeof ContributionRowSchema>;
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'unauthorized' });
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'unauthorized' });
  if (authData.user.app_metadata?.role !== 'admin') return json(403, { error: 'forbidden' });
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return json(400, { error: 'body' });
  }
  if ('user_id' in body && body.user_id === authData.user.id) return json(400, { error: 'self' });

  if (body.action === 'stats') {
    const failStats = (label: string) => { console.error(label, authData.user.id); return json(500, { error: 'stats' }); };
    const users: StatsUser[] = [];
    for (let page = 1; ; page += 1) {
      const result = await client.auth.admin.listUsers({ page, perPage: 1000 });
      if (result.error) return failStats('stats_users');
      users.push(...z.array(StatsUsersPageSchema).parse(result.data.users));
      if (result.data.users.length < 1000) break;
    }
    const readAll = async <T extends z.ZodType>(table: string, columns: string, schema: T): Promise<z.infer<T>[]> => {
      const rows: z.infer<T>[] = [];
      for (let offset = 0; ; offset += 1000) {
        const result = await client.from(table).select(columns).range(offset, offset + 999);
        if (result.error) throw new Error(table);
        const page = z.array(schema).parse(result.data ?? []);
        rows.push(...page);
        if (page.length < 1000) return rows;
      }
    };
    let profiles: z.infer<typeof StatsProfileSchema>[];
    let visits: z.infer<typeof StatsVisitSchema>[];
    let photos: z.infer<typeof StatsPhotoSchema>[];
    let reports: z.infer<typeof StatsReportSchema>[];
    let friendships: z.infer<typeof StatsFriendshipSchema>[];
    try {
      [profiles, visits, photos, reports, friendships] = await Promise.all([
        readAll('profiles', 'visibility', StatsProfileSchema),
        readAll('visits', 'work_slug,method,first_at', StatsVisitSchema),
        readAll('user_photos', 'review,archive', StatsPhotoSchema),
        readAll('a11y_reports', 'status', StatsReportSchema),
        readAll('friendships', 'status', StatsFriendshipSchema),
      ]);
    } catch {
      return failStats('stats_data');
    }
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const dateParts = (date: Date) => formatter.formatToParts(date);
    const todayParts = dateParts(new Date());
    const dateValue = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value ?? '';
    const today = `${dateValue(todayParts, 'year')}-${dateValue(todayParts, 'month')}-${dateValue(todayParts, 'day')}`;
    const dates = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(`${today}T00:00:00+03:00`);
      date.setUTCDate(date.getUTCDate() - (29 - index));
      const parts = dateParts(date);
      return `${dateValue(parts, 'year')}-${dateValue(parts, 'month')}-${dateValue(parts, 'day')}`;
    });
    const dailyCounts = () => new Map(dates.map((date) => [date, 0]));
    const signupsByDay = dailyCounts();
    const visitsByDay = dailyCounts();
    const cutoff30 = Date.parse(`${dates[0]}T00:00:00+03:00`);
    const now = Date.now();
    const cutoff7 = now - 7 * 24 * 60 * 60 * 1000;
    const topWorks = new Map<string, number>();
    const visitMethods = { route: 0, checkin: 0 };
    let recentVisits = 0;
    for (const user of users) {
      const created = Date.parse(user.created_at);
      const parts = dateParts(new Date(created));
      const date = `${dateValue(parts, 'year')}-${dateValue(parts, 'month')}-${dateValue(parts, 'day')}`;
      if (signupsByDay.has(date)) signupsByDay.set(date, signupsByDay.get(date)! + 1);
    }
    for (const visit of visits) {
      visitMethods[visit.method] += 1;
      topWorks.set(visit.work_slug, (topWorks.get(visit.work_slug) ?? 0) + 1);
      const created = Date.parse(visit.first_at);
      if (created >= cutoff30) {
        recentVisits += 1;
        const parts = dateParts(new Date(created));
        const date = `${dateValue(parts, 'year')}-${dateValue(parts, 'month')}-${dateValue(parts, 'day')}`;
        if (visitsByDay.has(date)) visitsByDay.set(date, visitsByDay.get(date)! + 1);
      }
    }
    const visibility = { private: 0, friends: 0, public: 0 };
    for (const profile of profiles) visibility[profile.visibility] += 1;
    const photoReviews = { pending: 0, approved: 0, rejected: 0, none: 0 };
    for (const photo of photos) photoReviews[photo.review] += 1;
    const reportStatuses = { pending: 0, approved: 0, rejected: 0 };
    for (const report of reports) reportStatuses[report.status] += 1;
    const friendshipStatuses = { accepted: 0, pending: 0 };
    for (const friendship of friendships) friendshipStatuses[friendship.status] += 1;
    const stats = StatsSchema.parse({
      users: {
        total: users.length,
        admins: users.filter((user) => user.app_metadata?.role === 'admin').length,
        banned: users.filter((user) => Boolean(user.banned_until && Date.parse(user.banned_until) > now)).length,
        new_7d: users.filter((user) => Date.parse(user.created_at) >= cutoff7).length,
        new_30d: users.filter((user) => Date.parse(user.created_at) >= cutoff30).length,
        active_7d: users.filter((user) => user.last_sign_in_at && Date.parse(user.last_sign_in_at) >= cutoff7).length,
        with_profile: profiles.length, visibility,
      },
      signups_by_day: dates.map((date) => ({ date, count: signupsByDay.get(date)! })),
      visits: {
        total: visits.length, last_30d: recentVisits, by_method: visitMethods,
        by_day: dates.map((date) => ({ date, count: visitsByDay.get(date)! })),
        top_works: [...topWorks].map(([work_slug, count]) => ({ work_slug, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      },
      photos: {
        by_review: photoReviews, archive_suggested: photos.filter((photo) => photo.archive === 'suggested').length,
      },
      reports: { by_status: reportStatuses }, friendships: friendshipStatuses,
    });
    return json(200, stats);
  }

  if (body.action === 'set_role') {
    // Auth sunucusu app_metadata'yı birleştirir: anahtarı silmek rolü kaldırmaz, null yazmak gerekir.
    // Diğer anahtarlar (provider, providers) gönderilmediği için olduğu gibi kalır.
    const { error } = await client.auth.admin.updateUserById(body.user_id, { app_metadata: { role: body.admin ? 'admin' : null } });
    if (error) { console.error('set_role', body.user_id); return json(500, { error: 'set_role' }); }
    return json(200, { ok: true });
  }
  if (body.action === 'ban') {
    const { error } = await client.auth.admin.updateUserById(body.user_id, { ban_duration: body.banned ? '876000h' : 'none' });
    if (error) { console.error('ban', body.user_id); return json(500, { error: 'ban' }); }
    return json(200, { ok: true });
  }
  if (body.action === 'delete') {
    for (const name of ['reports', 'avatars', 'user-photos']) {
      const bucket = client.storage.from(name);
      for (;;) {
        const listed = await bucket.list(body.user_id, { limit: 100 });
        if (listed.error) { console.error('list', body.user_id); return json(500, { error: 'storage' }); }
        if (!listed.data.length) break;
        const removed = await bucket.remove(listed.data.map((o) => `${body.user_id}/${o.name}`));
        if (removed.error) { console.error('remove', body.user_id); return json(500, { error: 'storage' }); }
      }
    }
    const { error } = await client.auth.admin.deleteUser(body.user_id);
    if (error) { console.error('delete', body.user_id); return json(500, { error: 'delete' }); }
    return json(200, { ok: true });
  }

  const users: User[] = [];
  for (let page = 1; ; page += 1) {
    const result = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) { console.error('list_users', authData.user.id); return json(500, { error: 'list' }); }
    users.push(...result.data.users);
    if (result.data.users.length < 1000) break;
  }
  const ids = users.map((user) => user.id);
  const profiles = new Map<string, Profile>();
  const visits = new Map<string, Visit[]>();
  const photos = new Map<string, { total: number; pending: number }>();
  const reports = new Map<string, { pending: number; approved: number }>();
  const contributions = new Map<string, Contribution>();
  const fail = (label: string) => { console.error(label, authData.user.id); return json(500, { error: 'list' }); };
  for (let start = 0; start < ids.length; start += 500) {
    const batch = ids.slice(start, start + 500);
    const [p, c] = await Promise.all([
      client.from('profiles').select('user_id,display_name,username,avatar_path').in('user_id', batch),
      client.from('contributions').select('user_id,reports_approved,photos_public,photos_archived,friends').in('user_id', batch),
    ]);
    if (p.error || c.error) return fail('list_data');
    for (const profile of z.array(ProfileRowSchema).parse(p.data ?? [])) profiles.set(profile.user_id, profile);
    for (const contribution of z.array(ContributionRowSchema).parse(c.data ?? [])) contributions.set(contribution.user_id, contribution);
    for (let offset = 0; ; offset += 1000) {
      const [v, ph, r] = await Promise.all([
        client.from('visits').select('user_id,work_slug,method,first_at').in('user_id', batch).order('first_at', { ascending: false }).range(offset, offset + 999),
        client.from('user_photos').select('user_id,review').in('user_id', batch).range(offset, offset + 999),
        client.from('a11y_reports').select('user_id,status').in('user_id', batch).range(offset, offset + 999),
      ]);
      if (v.error || ph.error || r.error) return fail('list_data');
      for (const visit of z.array(VisitRowSchema).parse(v.data ?? [])) visits.set(visit.user_id, [...(visits.get(visit.user_id) ?? []), visit]);
      for (const photo of z.array(PhotoRowSchema).parse(ph.data ?? [])) {
        const count = photos.get(photo.user_id) ?? { total: 0, pending: 0 };
        count.total += 1;
        if (photo.review === 'pending') count.pending += 1;
        photos.set(photo.user_id, count);
      }
      for (const report of z.array(ReportRowSchema).parse(r.data ?? [])) {
        const count = reports.get(report.user_id) ?? { pending: 0, approved: 0 };
        if (report.status === 'pending') count.pending += 1;
        if (report.status === 'approved') count.approved += 1;
        reports.set(report.user_id, count);
      }
      if ((v.data?.length ?? 0) < 1000 && (ph.data?.length ?? 0) < 1000 && (r.data?.length ?? 0) < 1000) break;
    }
  }
  const avatarPaths = [...new Set([...profiles.values()].flatMap((profile) => profile.avatar_path ? [profile.avatar_path] : []))];
  const avatarUrls = new Map<string, string>();
  for (let start = 0; start < avatarPaths.length; start += 500) {
    const paths = avatarPaths.slice(start, start + 500);
    const signed = await client.storage.from('avatars').createSignedUrls(paths, 3600);
    if (signed.error) return fail('avatar_urls');
    for (const item of signed.data ?? []) if (item.path && item.signedUrl) avatarUrls.set(item.path, item.signedUrl);
  }
  return json(200, { users: users.map((user) => {
    const profile = profiles.get(user.id);
    const visitRows = visits.get(user.id) ?? [];
    return {
      id: user.id, email: user.email ?? null, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at ?? null,
      banned: Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now()),
      is_admin: user.app_metadata?.role === 'admin', provider: typeof user.app_metadata?.provider === 'string' ? user.app_metadata.provider : null,
      profile: profile ? { display_name: profile.display_name, username: profile.username, avatar_url: profile.avatar_path ? avatarUrls.get(profile.avatar_path) ?? null : null } : null,
      counts: { visits: visitRows.length, photos: photos.get(user.id) ?? { total: 0, pending: 0 }, reports: reports.get(user.id) ?? { pending: 0, approved: 0 } },
      contributions: contributions.get(user.id) ?? null,
      recent_visits: visitRows.slice(0, 5),
    };
  }) });
});
