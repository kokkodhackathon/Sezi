import {
  Building2,
  Users,
  Camera,
  FilePlus2,
  FileText,
  Flag,
  Footprints,
  Images,
  Landmark,
  LayoutDashboard,
  MapPinned,
  Route,
  Signpost,
  type LucideIcon,
} from 'lucide-react';

import type { Dashboard } from './dashboard';

export interface NavItem {
  to: string;
  title: string;
  /** Sayfa başlığının altındaki tek cümle: bu sayfada ne yapılır. */
  hint: string;
  icon: LucideIcon;
  /** Menüde bekleyen iş sayısı (pano verisinden). */
  badge?: (d: Dashboard) => number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Menü, sayfa başlıkları ve panodaki kısayollar aynı listeden gelir. */
export const NAV: NavGroup[] = [
  {
    label: 'Genel',
    items: [{ to: '/', title: 'Pano', hint: 'Veri kapsamı ve sırada bekleyen işler.', icon: LayoutDashboard }],
  },
  {
    label: 'İçerik',
    items: [
      { to: '/eserler', title: 'Eserler', hint: 'Bütün eserler; ara, süz ve düzenlemek için aç.', icon: Landmark },
      { to: '/eserler/yeni', title: 'Yeni eser', hint: 'Envanterde olmayan bir eseri taslak olarak ekle.', icon: FilePlus2 },
      {
        to: '/metinler',
        title: 'Eser metinleri',
        hint: 'Kitaptan çıkarılan adres ve tarihçe taslaklarını kitap sayfasıyla karşılaştırıp yayınla.',
        icon: FileText,
        badge: (d) => d.texts.pending,
      },
      {
        to: '/fotograflar',
        title: 'Fotoğraf kutusu',
        hint: 'Esere bağlanmamış ya da onay bekleyen fotoğraflar; esere kaynaklı fotoğraf yükleme.',
        icon: Images,
        badge: (d) => d.photos.unlinked + d.photos.draftLinked,
      },
    ],
  },
  {
    label: 'Konum ve rota',
    items: [
      {
        to: '/eslestirme',
        title: 'Konum eşleştirme',
        hint: 'Eser başına konum adaylarından doğru olanı seç.',
        icon: MapPinned,
        badge: (d) => d.candidates.worksPending,
      },
      { to: '/noktalar', title: 'Noktalar', hint: 'Başlangıç, yer işareti, anlatım ve varış noktaları.', icon: Signpost },
      { to: '/turlar', title: 'Turlar', hint: 'Pilot alandaki hazır turlar: duraklar, sıra ve yayın.', icon: Footprints },
      { to: '/rota-testi', title: 'Rota testi', hint: 'Mobil uygulamanın rota motorunu telefonsuz dene.', icon: Route },
    ],
  },
  {
    label: 'Topluluk',
    items: [
      {
        to: '/bildirimler',
        title: 'Bildirimler',
        hint: 'Kullanıcıların erişilebilirlik bildirimlerini onayla ya da reddet.',
        icon: Flag,
        badge: (d) => d.reports.pending,
      },
      {
        to: '/topluluk-fotograflari',
        title: 'Ziyaretçi fotoğrafları',
        hint: 'Herkese açılmak ya da arşive önerilmek istenen kullanıcı fotoğrafları.',
        icon: Camera,
        badge: (d) => d.community.pending,
      },
      { to: '/kullanicilar', title: 'Kullanıcılar', hint: 'Kullanıcı hesaplarını, katkılarını ve erişim durumlarını yönet.', icon: Users },
    ],
  },
  {
    label: 'Ayarlar',
    items: [{ to: '/iller', title: 'İller', hint: 'İller, envanter bilgileri ve uygulamada görünürlük.', icon: Building2 }],
  },
];

const ALL = NAV.flatMap((g) => g.items);

/** Adrese en uzun eşleşen menü ögesi (ör. /eserler/bursa-ulucami → Eserler). */
export function navFor(pathname: string): NavItem | undefined {
  return ALL.filter((i) => (i.to === '/' ? pathname === '/' : pathname === i.to || pathname.startsWith(i.to + '/')))
    .sort((a, b) => b.to.length - a.to.length)[0];
}
