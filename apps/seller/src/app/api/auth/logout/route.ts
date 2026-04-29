import { NextResponse } from 'next/server';
import { destroySession } from '@/server/auth';

export async function POST() {
  await destroySession();
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SELLER_URL ?? 'https://seller.itsnottechy.cloud'), 303);
}
