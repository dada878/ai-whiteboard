import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminDb } from '@/app/config/firebase-admin';
import { WhiteboardData } from '@/app/types';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.error('No session found');
      return NextResponse.json({ error: 'Unauthorized - No session' }, { status: 401 });
    }
    
    if (!session.user.id) {
      console.error('No user ID in session:', session.user);
      return NextResponse.json({ error: 'Unauthorized - No user ID' }, { status: 401 });
    }

    console.log('API Debug - User ID:', session.user.id);
    console.log('API Debug - User Email:', session.user.email);
    console.log('API Debug - Firebase Project:', process.env.FIREBASE_PROJECT_ID);

    const body = await req.json();
    const { projectId, data, action, projectMetadata } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    const userId = session.user.id;

    switch (action) {
      case 'save':
        // Save whiteboard data
        if (!projectId) {
          return NextResponse.json({ error: 'Missing projectId for save action' }, { status: 400 });
        }
        
        try {
          // Save project metadata if provided
          if (projectMetadata) {
            console.log('Saving project metadata for:', projectId);
            console.log('Metadata received:', projectMetadata);
            
            // 建立安全的更新物件，過濾掉 undefined 值
            const updateData: any = {
              updatedAt: new Date().toISOString()
            };
            
            if (projectMetadata.name !== undefined) {
              updateData.name = projectMetadata.name;
            }
            if (projectMetadata.description !== undefined) {
              updateData.description = projectMetadata.description;
            }
            if (projectMetadata.createdAt !== undefined) {
              updateData.createdAt = projectMetadata.createdAt;
            }
            
            // 只有在有有效資料時才更新
            if (Object.keys(updateData).length > 1) { // 至少有 updatedAt 以外的欄位
              await adminDb
                .collection('users')
                .doc(userId)
                .collection('projects')
                .doc(projectId)
                .set(updateData, { merge: true });
            }
          }
          
          // Save whiteboard data if provided
          if (data) {
            console.log('Saving whiteboard data for:', projectId);
            console.log('Data structure:', {
              notes: data.notes?.length || 0,
              edges: data.edges?.length || 0,
              groups: data.groups?.length || 0,
              images: data.images?.length || 0
            });
            
            await adminDb
              .collection('users')
              .doc(userId)
              .collection('projects')
              .doc(projectId)
              .collection('data')
              .doc('whiteboard')
              .set({
                ...data,
                lastModified: new Date().toISOString()
              }, { merge: true });
          }
          
          return NextResponse.json({ success: true });
        } catch (saveError) {
          console.error('Error saving project data:', saveError);
          console.error('Error details:', {
            projectId,
            userId,
            hasData: !!data,
            hasMetadata: !!projectMetadata,
            error: saveError instanceof Error ? saveError.message : 'Unknown error'
          });
          return NextResponse.json({ 
            error: 'Failed to save project data',
            details: saveError instanceof Error ? saveError.message : 'Unknown error'
          }, { status: 500 });
        }

      case 'load':
        // Load whiteboard data
        if (!projectId) {
          return NextResponse.json({ error: 'Missing projectId for load action' }, { status: 400 });
        }
        const docRef = adminDb
          .collection('users')
          .doc(userId)
          .collection('projects')
          .doc(projectId)
          .collection('data')
          .doc('whiteboard');
        
        const doc = await docRef.get();
        
        if (doc.exists) {
          return NextResponse.json({ data: doc.data() });
        } else {
          return NextResponse.json({ data: null });
        }

      case 'list':
        // List all projects for the user
        console.log('API Debug - Attempting to read from path:', `users/${userId}/projects`);
        
        try {
          const listSnapshot = await adminDb
            .collection('users')
            .doc(userId)
            .collection('projects')
            .get();
          
          console.log('API Debug - Read successful, docs count:', listSnapshot.docs.length);
          
          const projectsList = listSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          return NextResponse.json({ projects: projectsList });
        } catch (firestoreError) {
          console.error('API Debug - Firestore error:', firestoreError);
          throw firestoreError;
        }

      case 'sync':
        // Sync all projects
        const projectsSnapshot = await adminDb
          .collection('users')
          .doc(userId)
          .collection('projects')
          .get();
        
        const projects = projectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        return NextResponse.json({ projects });

      case 'delete':
        // Delete a project
        if (!projectId) {
          return NextResponse.json({ error: 'Missing projectId for delete action' }, { status: 400 });
        }
        
        // Delete project metadata
        await adminDb
          .collection('users')
          .doc(userId)
          .collection('projects')
          .doc(projectId)
          .delete();
        
        // Delete project data
        const dataCollection = adminDb
          .collection('users')
          .doc(userId)
          .collection('projects')
          .doc(projectId)
          .collection('data');
        
        const dataDocs = await dataCollection.get();
        const batch = adminDb.batch();
        dataDocs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Sync API error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // 檢查是否是 Firebase 權限錯誤
    if (error instanceof Error && error.message.includes('permission')) {
      return NextResponse.json({ 
        error: 'Firebase permission denied',
        details: error.message 
      }, { status: 403 });
    }
    
    // 檢查是否是 Firebase 配置錯誤
    if (error instanceof Error && error.message.includes('Firebase')) {
      return NextResponse.json({ 
        error: 'Firebase configuration error',
        details: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}