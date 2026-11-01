/** Eser bilgisi gerektirmeyen, dar ve kesin sohbet niyetleri. Tarihî bilgi üretmez. */
export function askConversationReply(question: string, lang: 'tr' | 'en'): string | null {
  const q = question.toLocaleLowerCase('tr').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z\s]/g, '').trim();
  if (/^(senin )?(adin ne|ismin ne|kimsin|sen kimsin)$/.test(q) || /^(what is|whats) your name$|^who are you$/.test(q)) {
    return lang === 'tr' ? 'Ben Sezi! Vakıf eserlerinin hikâyelerini ve mimarisini birlikte keşfedebiliriz. Hangi şehri ya da eseri merak ediyorsun?' : 'I’m Sezi! We can explore the stories and architecture of heritage places together. Which city or place are you curious about?';
  }
  if (/^(merhaba|selam|selamlar|hey|hi|hello)( sezi)?$/.test(q)) {
    return lang === 'tr' ? 'Merhaba! Bir şehir ya da eser söyle, birlikte keşfedelim.' : 'Hello! Tell me a city or a place and let’s explore it together.';
  }
  if (/^(tesekkurler|tesekkur ederim|sag ol|sagol|thanks|thank you)$/.test(q)) {
    return lang === 'tr' ? 'Rica ederim! Başka bir eser ya da merak ettiğin bir ayrıntı varsa sorabilirsin.' : 'You’re welcome! Ask me about another place or any detail you’re curious about.';
  }
  return null;
}
