import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleAlert, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { searchWorks, slugify, tr, useLookups } from '@/lib/data';
import { supabase } from '@/lib/supabase';

/**
 * Yeni eser: kimlik bilgileriyle taslak olarak açılır, ayrıntılar düzenleme sayfasında doldurulur.
 * Taslak uygulamada görünmez; "Doğrula ve yayımla" ile yayına çıkar.
 */
export function NewWork() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: lookups } = useLookups();
  const [name, setName] = useState({ tr: '', en: '' });
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [district, setDistrict] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [problem, setProblem] = useState('');

  const cityRow = lookups?.cities.find((c) => c.id === city);
  // Aynı adla kayıtlı eser varsa uyarı (çift kayıt önlenir).
  const similar = useQuery({
    queryKey: ['similar', name.tr, cityRow?.slug],
    queryFn: () => searchWorks(name.tr, cityRow?.slug),
    enabled: name.tr.trim().length >= 4,
  });

  const nameTrInvalid = submitted && !name.tr.trim();
  const cityInvalid = submitted && !city;
  const typeInvalid = submitted && !type;

  const create = useMutation({
    mutationFn: async () => {
      if (!name.tr.trim()) throw new Error('Türkçe ad zorunlu.');
      if (!city || !type) throw new Error('İl ve tür seçin.');
      const base = slugify(`${cityRow?.slug ?? ''}-${name.tr}`);
      // Kısa ad benzersiz olmalı: doluysa -2, -3 … eklenir.
      const { data: taken } = await supabase.from('works').select('slug').like('slug', `${base}%`);
      const used = new Set((taken ?? []).map((r) => r.slug as string));
      let slug = base;
      for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
      const { error } = await supabase.from('works').insert({
        slug,
        name: { tr: name.tr.trim(), ...(name.en.trim() ? { en: name.en.trim() } : {}) },
        city_id: city,
        work_type_id: type,
        district: district.trim() || null,
        status: 'draft',
        location_precision: 'unknown',
        needs_review: true,
      });
      if (error) throw error;
      return slug;
    },
    onSuccess: (slug) => {
      void qc.invalidateQueries({ queryKey: ['works'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Taslak eser oluşturuldu.');
      navigate(`/eserler/${slug}`);
    },
    onError: (e) => {
      const msg = e.message;
      setProblem(msg);
      toast.error(msg);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setProblem('');
    if (!name.tr.trim() || !city || !type) return;
    create.mutate();
  };

  return (
    <>
      <PageHeader
        actions={
          <Button variant="outline" asChild>
            <Link to="/eserler">
              <ArrowLeft data-icon="inline-start" />
              Eserler
            </Link>
          </Button>
        }
      />

      <form onSubmit={submit} noValidate className="max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Kimlik bilgileri</CardTitle>
            <CardDescription>
              Eser taslak olarak açılır ve uygulamada görünmez. Konum, içerik ve fotoğrafları bir sonraki sayfada ekleyip yayımlarsınız.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={nameTrInvalid || undefined}>
                  <FieldLabel htmlFor="name-tr">Ad (TR) *</FieldLabel>
                  <Input
                    id="name-tr"
                    value={name.tr}
                    onChange={(e) => setName({ ...name, tr: e.target.value })}
                    placeholder="Örn. Ulu Cami"
                    aria-invalid={nameTrInvalid || undefined}
                    required
                  />
                  {nameTrInvalid ? <FieldError>Türkçe ad zorunludur.</FieldError> : null}
                </Field>

                <Field>
                  <FieldLabel htmlFor="name-en">Ad (EN)</FieldLabel>
                  <Input
                    id="name-en"
                    value={name.en}
                    onChange={(e) => setName({ ...name, en: e.target.value })}
                    placeholder="Örn. Grand Mosque"
                  />
                  <FieldDescription>İsteğe bağlı; daha sonra da eklenebilir.</FieldDescription>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={cityInvalid || undefined}>
                  <FieldLabel htmlFor="city">İl *</FieldLabel>
                  <Select value={city || undefined} onValueChange={setCity}>
                    <SelectTrigger id="city" className="w-full" aria-invalid={cityInvalid || undefined}>
                      <SelectValue placeholder="İl seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {lookups?.cities.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {tr(c.name)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {cityInvalid ? <FieldError>İl seçimi zorunludur.</FieldError> : null}
                </Field>

                <Field data-invalid={typeInvalid || undefined}>
                  <FieldLabel htmlFor="type">Tür *</FieldLabel>
                  <Select value={type || undefined} onValueChange={setType}>
                    <SelectTrigger id="type" className="w-full" aria-invalid={typeInvalid || undefined}>
                      <SelectValue placeholder="Tür seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {lookups?.types.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {tr(t.name)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {typeInvalid ? <FieldError>Tür seçimi zorunludur.</FieldError> : null}
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="district">İlçe</FieldLabel>
                <Input
                  id="district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Örn. Osmangazi"
                />
              </Field>
            </FieldGroup>

            {similar.data && similar.data.length > 0 ? (
              <Alert role="status">
                <TriangleAlert />
                <AlertTitle>Benzer adlı eserler var</AlertTitle>
                <AlertDescription>
                  <p className="mb-1.5">Çift kayıt açmamak için mevcut kayıtları kontrol edin:</p>
                  <ul className="list-disc pl-5">
                    {similar.data.slice(0, 5).map((w) => (
                      <li key={w.id}>
                        <Link to={`/eserler/${w.slug}`} className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
                          {tr(w.name)}
                        </Link>{' '}
                        <span className="text-muted-foreground">· {w.district ?? w.city_slug}</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            {problem ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Oluşturulamadı</AlertTitle>
                <AlertDescription>{problem}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" asChild>
              <Link to="/eserler">Vazgeç</Link>
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Spinner data-icon="inline-start" /> : null}
              {create.isPending ? 'Oluşturuluyor…' : 'Taslak olarak oluştur'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
