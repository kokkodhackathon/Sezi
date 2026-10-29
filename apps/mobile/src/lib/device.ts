import Storage from 'expo-sqlite/kv-store';

import { uuid } from './uuid';

const DEVICE_KEY = 'sezi.device.v1';

/**
 * Kişisel bilgi taşımayan cihaz kimliği. Sunucu bunu ham hâliyle saklamaz; yalnız kötüye kullanım sınırında
 * tek yönlü özet üretmek için kullanır. Uygulama silinirse kimlik de silinir.
 */
export function deviceId(): string {
  let id = Storage.getItemSync(DEVICE_KEY);
  if (!id) {
    id = uuid();
    Storage.setItemSync(DEVICE_KEY, id);
  }
  return id;
}
