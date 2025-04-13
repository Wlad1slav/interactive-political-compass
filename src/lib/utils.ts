import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { readFileSync } from 'fs';
import { extname } from 'path';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function imageFileToBase64(url: string) {
  // Завантажуємо ресурс
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Не вдалося завантажити зображення: ${res.status} ${res.statusText}`);
  }

  // Беремо MIME-тип з відповіді, або дефолтимо на image/png
  const contentType = res.headers.get('content-type') || 'image/png';

  // Зчитуємо тіло як ArrayBuffer і конвертуємо в Buffer
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // В Base64
  const base64 = buffer.toString('base64');

  // Повертаємо повний data URI
  return `data:${contentType};base64,${base64}`;
}