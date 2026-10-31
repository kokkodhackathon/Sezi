import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { MoreHorizontal, RotateCcw, Search, Shield, Trash2, UserRound } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth-context';
import {
  useUserAction,
  useUsers,
  type ManagedUser,
  type UserAction,
} from '@/lib/users';

type Filter = 'all' | 'admins' | 'banned';
type Pending = {
  user: ManagedUser;
  action: UserAction;
  title: string;
  description: string;
  confirm: string;
};

const FILTERS: Filter[] = ['all', 'admins', 'banned'];

function isFilter(value: string): value is Filter {
  return FILTERS.some((filter) => filter === value);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toLocaleUpperCase('tr-TR') || '?';
}

function relativeDate(value: string | null) {
  if (!value) return '—';
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return 'Bugün';
  if (days === 1) return 'Dün';
  return `${days} gün önce`;
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function UserIdentity({ user }: { user: ManagedUser }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={user.profile?.avatar_url ?? undefined} />
        <AvatarFallback>{initials(user.profile?.display_name ?? user.email ?? '?')}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium">{user.profile?.display_name ?? 'Profilsiz kullanıcı'}</p>
        <p className="truncate text-xs text-muted-foreground">
          {user.profile?.username ? `@${user.profile.username} · ` : ''}
          {user.email ?? 'E-posta yok'}
        </p>
      </div>
    </div>
  );
}

function UserStatus({ user }: { user: ManagedUser }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {user.is_admin && <Badge variant="secondary" className="whitespace-nowrap">Yönetici</Badge>}
      {user.banned && <Badge variant="destructive" className="whitespace-nowrap">Askıda</Badge>}
      {!user.is_admin && !user.banned && <span className="text-muted-foreground">—</span>}
    </div>
  );
}

function UserMenu({ user, currentId, ask }: {
  user: ManagedUser;
  currentId: string | undefined;
  ask: (user: ManagedUser, action: UserAction, title: string, description: string, confirm: string) => void;
}) {
  const ownAccount = user.id === currentId;
  const label = user.profile?.display_name ?? user.email ?? 'Bu kullanıcı';

  if (ownAccount) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            <Button variant="ghost" size="icon" aria-label="Kendi hesabınız" disabled>
              <MoreHorizontal />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Kendi hesabınız</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`${label} işlemleri`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => ask(
            user,
            { action: 'set_role', user_id: user.id, admin: !user.is_admin },
            user.is_admin ? 'Yöneticilik kaldırıldı.' : 'Yönetici rolü verildi.',
            `${label} için ${user.is_admin ? 'yöneticilik kaldırılacak' : 'yönetici rolü verilecek'}. Değişiklik, kullanıcının sonraki oturum açma veya yaklaşık bir saat içindeki anahtar yenilemesinde etkili olur.`,
            user.is_admin ? 'Yöneticiliği kaldır' : 'Yönetici yap',
          )}
        >
          <Shield />{user.is_admin ? 'Yöneticiliği kaldır' : 'Yönetici yap'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => ask(
            user,
            { action: 'ban', user_id: user.id, banned: !user.banned },
            user.banned ? 'Hesap askıdan kaldırıldı.' : 'Hesap askıya alındı.',
            `${label} ${user.banned ? 'yeniden giriş yapabilir.' : 'askıya alınacak ve giriş yapamayacak.'}`,
            user.banned ? 'Askıyı kaldır' : 'Askıya al',
          )}
        >
          <UserRound />{user.banned ? 'Askıyı kaldır' : 'Askıya al'}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => ask(
            user,
            { action: 'delete', user_id: user.id },
            'Hesap silindi.',
            `${label} hesabı geri alınamaz biçimde silinecek. Fotoğraflar, ziyaretler ve arkadaşlıklar kaldırılır; arşivlenmiş medya kopyaları korunur.`,
            'Hesabı sil',
          )}
        >
          <Trash2 />Hesabı sil
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserRow({
  user,
  currentId,
  ask,
  onSelect,
}: {
  user: ManagedUser;
  currentId: string | undefined;
  ask: (user: ManagedUser, action: UserAction, title: string, description: string, confirm: string) => void;
  onSelect: (user: ManagedUser) => void;
}) {
  return (
    <tr
      onClick={() => onSelect(user)}
      className="cursor-pointer border-b last:border-0 hover:bg-muted/40 focus-within:bg-muted/40"
    >
      <td className="min-w-0 px-4 py-3"><UserIdentity user={user} /></td>
      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{shortDate(user.created_at)}</td>
      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{relativeDate(user.last_sign_in_at)}</td>
      <td className="px-3 py-3 text-right tabular-nums">{user.counts.visits}</td>
      <td className="px-3 py-3 text-right tabular-nums">{user.counts.photos.total}</td>
      <td className="px-3 py-3 text-right tabular-nums">
        {user.counts.reports.pending + user.counts.reports.approved}
      </td>
      <td className="px-3 py-3"><UserStatus user={user} /></td>
      <td className="w-12 px-2 py-2" onClick={(event) => event.stopPropagation()}>
        <UserMenu user={user} currentId={currentId} ask={ask} />
      </td>
    </tr>
  );
}

function UserTable({
  users,
  currentId,
  ask,
  onSelect,
}: {
  users: ManagedUser[];
  currentId: string | undefined;
  ask: (user: ManagedUser, action: UserAction, title: string, description: string, confirm: string) => void;
  onSelect: (user: ManagedUser) => void;
}) {
  return (
    <div className="hidden min-w-0 overflow-x-auto lg:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="min-w-[240px] px-4 py-3 font-medium">Kullanıcı</th>
            <th className="whitespace-nowrap px-3 py-3 font-medium">Kayıt tarihi</th>
            <th className="whitespace-nowrap px-3 py-3 font-medium">Son giriş</th>
            <th className="px-3 py-3 text-right font-medium">Ziyaret</th>
            <th className="px-3 py-3 text-right font-medium">Fotoğraf</th>
            <th className="px-3 py-3 text-right font-medium">Bildirim</th>
            <th className="px-3 py-3 font-medium">Rol / durum</th>
            <th className="w-12 px-2 py-3"><span className="sr-only">İşlemler</span></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              currentId={currentId}
              ask={ask}
              onSelect={onSelect}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompactUserList({
  users,
  currentId,
  ask,
  onSelect,
}: {
  users: ManagedUser[];
  currentId: string | undefined;
  ask: (user: ManagedUser, action: UserAction, title: string, description: string, confirm: string) => void;
  onSelect: (user: ManagedUser) => void;
}) {
  return (
    <ul className="min-w-0 divide-y lg:hidden">
      {users.map((user) => (
        <li key={user.id} className="min-w-0">
          <div className="flex min-w-0 items-start gap-2 px-3 py-3 sm:px-4">
            <button
              type="button"
              className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSelect(user)}
              aria-label={`${user.profile?.display_name ?? user.email ?? 'Kullanıcı'} ayrıntıları`}
            >
              <UserIdentity user={user} />
              <p className="mt-1 truncate pl-11 text-xs text-muted-foreground">
                Kayıt {shortDate(user.created_at)} · Son giriş {relativeDate(user.last_sign_in_at)} · {user.counts.visits} ziyaret
              </p>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <UserStatus user={user} />
              <UserMenu user={user} currentId={currentId} ask={ask} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function UserSheet({ user, onClose }: { user: ManagedUser | null; onClose: () => void }) {
  return (
    <Sheet open={user !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full min-w-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{user?.profile?.display_name ?? user?.email ?? 'Kullanıcı'}</SheetTitle>
          <SheetDescription>
            {user?.profile?.username ? `@${user.profile.username} · ` : ''}
            {user?.email ?? 'E-posta yok'}
          </SheetDescription>
        </SheetHeader>
        {user && (
          // SheetHeader kendi iç boşluğuyla gelir; gövde aynı sol kenarda dursun.
          <div className="min-w-0 space-y-6 px-4 pb-6">
            <dl className="grid grid-cols-2 gap-3 text-sm tabular-nums">
              <Detail label="Ziyaret">{user.counts.visits}</Detail>
              <Detail label="Fotoğraf">{user.counts.photos.total}</Detail>
              <Detail label="Bekleyen fotoğraf incelemesi">{user.counts.photos.pending}</Detail>
              <Detail label="Bildirim · bekleyen / onaylanan">
                {user.counts.reports.pending} / {user.counts.reports.approved}
              </Detail>
              <Detail label="Katkı · onaylı bildirim">{user.contributions?.reports_approved ?? 0}</Detail>
              <Detail label="Katkı · herkese açık fotoğraf">{user.contributions?.photos_public ?? 0}</Detail>
              <Detail label="Katkı · arşiv">{user.contributions?.photos_archived ?? 0}</Detail>
              <Detail label="Arkadaş">{user.contributions?.friends ?? 0}</Detail>
            </dl>
            <section className="min-w-0">
              <h3 className="mb-2 font-heading font-bold">Son ziyaretler</h3>
              {user.recent_visits.length ? (
                <ul className="divide-y rounded-md border">
                  {user.recent_visits.map((visit) => (
                    <li
                      key={`${visit.work_slug}-${visit.first_at}`}
                      className="flex min-w-0 items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <Link className="truncate hover:underline" to={`/eserler/${visit.work_slug}`}>
                        {visit.work_slug}
                      </Link>
                      <span className="shrink-0 text-muted-foreground">{shortDate(visit.first_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Henüz ziyaret yok</p>}
            </section>
            {user.counts.photos.pending > 0 ? (
              <p className="text-sm">
                {user.counts.photos.pending} fotoğraf inceleme bekliyor ·{' '}
                <Link className="underline underline-offset-4" to="/topluluk-fotograflari">
                  Fotoğrafları aç
                </Link>
              </p>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums font-semibold">{children}</dd>
    </div>
  );
}

function ConfirmDialog({
  pending,
  busy,
  onCancel,
  onConfirm,
}: {
  pending: Pending | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pending?.confirm} — {pending?.user.profile?.display_name ?? pending?.user.email ?? 'kullanıcı'}
          </AlertDialogTitle>
          <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending?.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Users() {
  const { session } = useAuth();
  const { data = [], isLoading, error, refetch } = useUsers();
  const action = useUserAction();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const currentId = session?.user.id;
  const adminCount = data.filter((user) => user.is_admin).length;
  const bannedCount = data.filter((user) => user.banned).length;
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    return data.filter((user) => {
      if (filter === 'admins' && !user.is_admin) return false;
      if (filter === 'banned' && !user.banned) return false;
      return !query || [
        user.profile?.display_name,
        user.profile?.username ? `@${user.profile.username}` : '',
        user.email,
      ].some((value) => value?.toLocaleLowerCase('tr-TR').includes(query));
    });
  }, [data, filter, search]);

  const ask = (
    user: ManagedUser,
    actionBody: UserAction,
    title: string,
    description: string,
    confirm: string,
  ) => setPending({ user, action: actionBody, title, description, confirm });

  async function confirmAction() {
    if (!pending) return;
    try {
      await action.mutateAsync(pending.action);
      toast.success(pending.title);
      setPending(null);
      setSelected(null);
    } catch (cause) {
      toast.error(`İşlem başarısız: ${cause instanceof Error ? cause.message : 'Beklenmeyen hata'}`);
    }
  }

  return (
    <TooltipProvider>
      <PageHeader />
      <section className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-muted-foreground tabular-nums">
            {isLoading ? 'Yükleniyor…' : `${data.length} kullanıcı · ${adminCount} yönetici · ${bannedCount} askıda`}
          </p>
          <div className="relative w-full min-w-0 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Kullanıcı ara"
              placeholder="Ad, @kullanıcı adı veya e-posta"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-0 pl-9"
            />
          </div>
        </div>
        <Tabs
          value={filter}
          onValueChange={(value) => { if (isFilter(value)) setFilter(value); }}
        >
          <TabsList aria-label="Kullanıcı filtresi">
            <TabsTrigger value="all">Tümü</TabsTrigger>
            <TabsTrigger value="admins">Yöneticiler</TabsTrigger>
            <TabsTrigger value="banned">Askıdakiler</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="min-w-0 overflow-hidden rounded-lg border bg-card">
          {error ? (
            <Alert variant="destructive" className="m-4">
              <AlertTitle>Kullanıcılar alınamadı</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                Liste yüklenirken hata oluştu.
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  <RotateCcw />Yeniden dene
                </Button>
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="space-y-3 p-4" aria-label="Kullanıcılar yükleniyor">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Aramayla eşleşen kullanıcı yok</p>
          ) : (
            <>
              <UserTable
                users={rows}
                currentId={currentId}
                ask={ask}
                onSelect={setSelected}
              />
              <CompactUserList
                users={rows}
                currentId={currentId}
                ask={ask}
                onSelect={setSelected}
              />
            </>
          )}
        </div>
      </section>
      <UserSheet user={selected} onClose={() => setSelected(null)} />
      <ConfirmDialog
        pending={pending}
        busy={action.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmAction()}
      />
    </TooltipProvider>
  );
}
