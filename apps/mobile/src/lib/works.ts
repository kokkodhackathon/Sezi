import type { LocalizedText } from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';

export interface WorkSource {
  id: string;
  title: string;
  publisher: string | null;
  year: number | null;
  url: string | null;
  page: string | null;
}

/** public.works_view satırı (RLS: anonim kullanıcı yalnızca verified eserleri görür). */
export interface WorkRow {
  id: string;
  slug: string;
  name: LocalizedText;
  summary: LocalizedText | null;
  history: LocalizedText | null;
  built_year: number | null;
  founder: string | null;
  a11y_score: number | null;
  type_slug: string;
  type_name: LocalizedText;
  complex_slug: string | null;
  complex_name: LocalizedText | null;
  lng: number;
  lat: number;
  sources: WorkSource[];
}

export type Lang = 'tr' | 'en';

export function loc(text: LocalizedText | null | undefined, lang: Lang): string {
  if (!text) return '';
  return text[lang] ?? text.tr;
}

export function useWorks() {
  return useQuery({
    queryKey: ['works'],
    queryFn: async () => {
      const { data, error } = await supabase.from('works_view').select('*').order('slug');
      if (error) throw error;
      return data as WorkRow[];
    },
  });
}

export function useWork(slug: string) {
  return useQuery({
    queryKey: ['work', slug],
    queryFn: async () => {
      const { data, error } = await supabase.from('works_view').select('*').eq('slug', slug).maybeSingle();
      if (error) throw error;
      return data as WorkRow | null;
    },
  });
}
