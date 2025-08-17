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
        
        // Save project metadata if provided
        if (projectMetadata) {
          await adminDb
            .collection('users')
            .doc(userId)
            .collection('projects')
            .doc(projectId)
            .set({
              name: projectMetadata.name,
              description: projectMetadata.description,
              createdAt: projectMetadata.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }, { merge: true });
        }
        
        // Save whiteboard data
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
        
        return NextResponse.json({ success: true });

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}