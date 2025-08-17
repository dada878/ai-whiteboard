import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminDb } from '@/app/config/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, projectId, versionData, versionId } = body;
    const userId = session.user.id;

    switch (action) {
      case 'save':
        // 儲存新版本快照
        if (!projectId || !versionData) {
          return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
        }

        const newVersion = {
          projectId,
          data: versionData,
          createdAt: new Date().toISOString(),
          type: versionData.isAuto ? 'auto' : 'manual',
          name: versionData.name || `版本 ${new Date().toLocaleString('zh-TW')}`,
          description: versionData.description || '',
          stats: {
            notes: versionData.notes?.length || 0,
            edges: versionData.edges?.length || 0,
            groups: versionData.groups?.length || 0,
            images: versionData.images?.length || 0
          }
        };

        const versionRef = await adminDb
          .collection('users')
          .doc(userId)
          .collection('projects')
          .doc(projectId)
          .collection('versions')
          .add(newVersion);

        // 清理舊的自動備份（保留最近 10 個）
        if (versionData.isAuto) {
          const autoVersions = await adminDb
            .collection('users')
            .doc(userId)
            .collection('projects')
            .doc(projectId)
            .collection('versions')
            .where('type', '==', 'auto')
            .orderBy('createdAt', 'desc')
            .get();

          if (autoVersions.docs.length > 10) {
            const batch = adminDb.batch();
            autoVersions.docs.slice(10).forEach(doc => {
              batch.delete(doc.ref);
            });
            await batch.commit();
          }
        }

        return NextResponse.json({ 
          success: true, 
          versionId: versionRef.id 
        });

      case 'list':
        // 列出專案的所有版本
        if (!projectId) {
          return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
        }

        const versions = await adminDb
          .collection('users')
          .doc(userId)
          .collection('projects')
          .doc(projectId)
          .collection('versions')
          .orderBy('createdAt', 'desc')
          .get();

        const versionList = versions.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // 不返回完整資料，只返回摘要
          data: undefined,
          hasData: true
        }));

        return NextResponse.json({ versions: versionList });

      case 'load':
        // 載入特定版本的資料
        if (!projectId || !versionId) {
          return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const versionDoc = await adminDb
          .collection('users')
          .doc(userId)
          .collection('projects')
          .doc(projectId)
          .collection('versions')
          .doc(versionId)
          .get();

        if (!versionDoc.exists) {
          return NextResponse.json({ error: 'Version not found' }, { status: 404 });
        }

        return NextResponse.json({ version: versionDoc.data() });

      case 'delete':
        // 刪除版本
        if (!projectId || !versionId) {
          return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        await adminDb
          .collection('users')
          .doc(userId)
          .collection('projects')
          .doc(projectId)
          .collection('versions')
          .doc(versionId)
          .delete();

        return NextResponse.json({ success: true });

      case 'restore':
        // 還原到特定版本
        if (!projectId || !versionId) {
          return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const restoreDoc = await adminDb
          .collection('users')
          .doc(userId)
          .collection('projects')
          .doc(projectId)
          .collection('versions')
          .doc(versionId)
          .get();

        if (!restoreDoc.exists) {
          return NextResponse.json({ error: 'Version not found' }, { status: 404 });
        }

        const versionToRestore = restoreDoc.data();
        
        // 更新當前專案資料
        await adminDb
          .collection('users')
          .doc(userId)
          .collection('projects')
          .doc(projectId)
          .collection('data')
          .doc('whiteboard')
          .set({
            ...versionToRestore?.data,
            lastModified: new Date().toISOString(),
            restoredFrom: versionId,
            restoredAt: new Date().toISOString()
          }, { merge: false });

        return NextResponse.json({ 
          success: true,
          data: versionToRestore?.data 
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Version API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}