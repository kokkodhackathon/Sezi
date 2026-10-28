import { notFound } from "next/navigation";

/** Bilinmeyen dil altı adres: yerleşim içindeki yerelleştirilmiş 404. */
export default function UnknownPage() {
  notFound();
}
