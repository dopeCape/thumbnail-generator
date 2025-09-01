
import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request): Promise<NextResponse> {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json(
      { error: '`url` body parameter is required.' },
      { status: 400 },
    );
  }

  try {
    await del(url);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to delete blob: ${error.message}` },
      { status: 500 },
    );
  }
}
