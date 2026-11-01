import { describe, expect, it } from 'vitest';
import { askConversationReply } from './ask-conversation';
describe('kaynak gerektirmeyen sohbet', () => {
  it('kimlik ve selamlaşmayı doğal yanıtlar', () => {
    expect(askConversationReply('Senin adın ne?', 'tr')).toContain('Ben Sezi');
    expect(askConversationReply('Who are you?', 'en')).toContain('Sezi');
    expect(askConversationReply('Merhaba Sezi!', 'tr')).toContain('Merhaba');
  });
  it('eser ve karışık soruları sohbet diye yutmaz', () => {
    for (const q of ['Merhaba Ulucami nerede?', 'Ulucami kaç yılında yapıldı?', 'Senin adın ne, Bursa’da nerelere gidebilirim?']) expect(askConversationReply(q, 'tr')).toBeNull();
  });
});
