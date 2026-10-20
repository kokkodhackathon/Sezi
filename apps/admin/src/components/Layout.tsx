import { LogOut, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth-context';
import { useDashboard } from '@/lib/dashboard';
import { NAV, navFor } from '@/lib/nav';
import { supabase } from '@/lib/supabase';
import { Login } from '@/pages/Login';

/** Oturum yoksa giriş; rol admin değilse açıklama; admin ise menü + içerik. */
export function Layout() {
  const { session, loading, isAdmin, signOut } = useAuth();
  if (loading) {
    return (
      <div className="grid h-full place-items-center text-muted-foreground" role="status">
        <Spinner />
        <span className="sr-only">Yükleniyor</span>
      </div>
    );
  }
  if (!session) return <Login />;
  if (!isAdmin) return <NotAdmin email={session.user.email ?? ''} signOut={signOut} />;
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar email={session.user.email ?? ''} signOut={signOut} />
        <SidebarInset>
          <TopBar />
          <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 pt-6 pb-16 lg:px-10">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}

function AppSidebar({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  const { pathname } = useLocation();
  const active = navFor(pathname);
  // Menüdeki bekleyen iş sayıları panoyla aynı sorgudan (önbellekte paylaşılır).
  const { data } = useDashboard();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Sezi">
              <NavLink to="/">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary font-heading text-base font-extrabold text-primary-foreground">
                  S
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-heading text-base font-extrabold">Sezi</span>
                  <span className="text-xs text-muted-foreground">Yönetim paneli</span>
                </span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const count = data && item.badge ? item.badge(data) : 0;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active?.to === item.to} tooltip={item.title}>
                        <NavLink to={item.to} end>
                          <item.icon />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                      {count > 0 ? (
                        <SidebarMenuBadge aria-label={`${count} bekleyen`} className="num">
                          {count}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="truncate px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{email}</div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Çıkış yap" onClick={() => void signOut()}>
              <LogOut />
              <span>Çıkış yap</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function TopBar() {
  const { pathname } = useLocation();
  const item = navFor(pathname);
  const group = NAV.find((g) => g.items.some((i) => i.to === item?.to));
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur lg:px-6">
      <SidebarTrigger aria-label="Menüyü aç/kapat" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {group && group.label !== 'Genel' ? (
            <>
              <BreadcrumbItem className="hidden md:block">{group.label}</BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
            </>
          ) : null}
          <BreadcrumbItem>
            <BreadcrumbPage>{item?.title ?? 'Sezi'}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}

/**
 * Rol sonradan verildiyse oturum anahtarında henüz yazmaz. Anahtarı yenilemek (refresh) güncel rolü getirir;
 * yeniden giriş ve e-posta gerekmez. Ekran açılınca bir kez kendiliğinden denenir.
 */
function NotAdmin({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  const [state, setState] = useState<'refreshing' | 'still'>('refreshing');
  const refresh = async () => {
    setState('refreshing');
    const { data } = await supabase.auth.refreshSession();
    // Rol geldiyse AuthProvider oturum değişikliğini yakalar ve panel açılır.
    if (data.session?.user.app_metadata?.role !== 'admin') setState('still');
  };
  useEffect(() => {
    void refresh();
    // Yalnızca ilk açılışta bir kez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-full place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <ShieldAlert className="mb-2 text-destructive" aria-hidden />
          <CardTitle className="text-xl">Yetki gerekiyor</CardTitle>
          <CardDescription>
            <strong className="text-foreground">{email}</strong> hesabıyla giriş yaptınız ama bu hesapta yönetici rolü görünmüyor.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground" role="status">
          {state === 'refreshing' ? 'Yetki denetleniyor…' : 'Rol hâlâ tanımlı değil. Bir yönetici rol verdikten sonra “Yetkiyi yenile”ye basın.'}
        </CardContent>
        <CardFooter className="gap-2">
          <Button disabled={state === 'refreshing'} onClick={() => void refresh()}>
            {state === 'refreshing' ? <Spinner data-icon="inline-start" /> : null}
            Yetkiyi yenile
          </Button>
          <Button variant="outline" onClick={() => void signOut()}>
            Çıkış yap
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
