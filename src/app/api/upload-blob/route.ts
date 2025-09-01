
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';


export async function POST(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');

  if (!filename || !request.body) {
    return NextResponse.json(
      { error: '`filename` query parameter is required.' },
      { status: 400 },
    );
  }

  // The 'request.body' is a ReadableStream, which is what the 'put' function expects.
  const blob = await put(filename, request.body, {
    access: 'public', // Make the file publicly accessible
    allowOverwrite: true
  });

  return NextResponse.json(blob);
}
