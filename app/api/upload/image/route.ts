import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminStorage } from '@/app/config/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FORMATS = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

export async function POST(req: NextRequest) {
  console.log('=== Image Upload API Called ===');
  
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    console.log('Session:', session ? 'Found' : 'Not found');
    console.log('User email:', session?.user?.email);
    
    // Allow both authenticated users and guest mode
    const isGuestMode = req.headers.get('x-guest-mode') === 'true';
    console.log('Guest mode:', isGuestMode);
    
    if (!session && !isGuestMode) {
      console.error('Unauthorized: No session and not guest mode');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    console.log('File received:', file ? `${file.name} (${file.size} bytes)` : 'No file');
    
    if (!file) {
      console.error('No file provided in form data');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    console.log('File type:', file.type);
    if (!ALLOWED_FORMATS.includes(file.type)) {
      console.error('Unsupported file format:', file.type);
      return NextResponse.json(
        { error: `Unsupported file format. Allowed formats: ${ALLOWED_FORMATS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    console.log('File size:', file.size, 'bytes, Max allowed:', MAX_FILE_SIZE);
    if (file.size > MAX_FILE_SIZE) {
      console.error('File too large:', file.size);
      return NextResponse.json(
        { error: `File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // For guest mode, still use base64
    if (isGuestMode) {
      console.log('Guest mode: Converting to base64...');
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = `data:${file.type};base64,${buffer.toString('base64')}`;
      console.log('Base64 created, length:', base64.length);
      
      const response = {
        url: base64,
        filename: file.name,
        size: file.size,
        type: 'local'
      };
      
      console.log('Returning response with local base64 image');
      return NextResponse.json(response);
    }

    // For authenticated users, upload to Firebase Storage
    console.log('Uploading to Firebase Storage...');
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `whiteboard-images/${session.user?.id || 'anonymous'}/${uuidv4()}.${fileExtension}`;
    console.log('Storage path:', uniqueFileName);
    
    // Get bucket and create file reference
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(uniqueFileName);
    
    // Upload file to Firebase Storage
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          originalName: file.name,
          uploadedBy: session.user?.email || 'anonymous',
          uploadedAt: new Date().toISOString()
        }
      }
    });
    
    // Make file publicly accessible
    await fileRef.makePublic();
    
    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;
    console.log('File uploaded successfully:', publicUrl);
    
    const response = {
      url: publicUrl,
      filename: file.name,
      size: file.size,
      type: 'cloud',
      storagePath: uniqueFileName
    };
    
    console.log('Returning response with Firebase Storage URL');
    return NextResponse.json(response);

  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}