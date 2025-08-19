import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import '@/app/config/firebase-admin';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get('email');
  
  if (!email) {
    return NextResponse.json({ error: '請提供 email 參數' }, { status: 400 });
  }
  
  try {
    const db = getFirestore();
    const result: any = {
      email,
      users: [],
      accounts: [],
      profiles: null,
      waitlist: []
    };
    
    // 檢查 users collection
    const usersQuery = await db.collection('users')
      .where('email', '==', email)
      .get();
    
    usersQuery.forEach(doc => {
      result.users.push({ id: doc.id, ...doc.data() });
    });
    
    // 檢查 accounts collection
    const accountsQuery = await db.collection('accounts').get();
    accountsQuery.forEach(doc => {
      const data = doc.data();
      if (data.userId === email || 
          usersQuery.docs.some(userDoc => userDoc.id === data.userId)) {
        result.accounts.push({ id: doc.id, ...data });
      }
    });
    
    // 檢查 profiles collection
    const profileDoc = await db.collection('profiles').doc(email).get();
    if (profileDoc.exists) {
      result.profiles = profileDoc.data();
    }
    
    // 檢查 waitlist
    const waitlistQuery = await db.collection('waitlist')
      .where('email', '==', email)
      .get();
    
    waitlistQuery.forEach(doc => {
      result.waitlist.push({ id: doc.id, ...doc.data() });
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('檢查失敗:', error);
    return NextResponse.json({ error: '檢查失敗' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get('email');
  const type = searchParams.get('type'); // all, accounts, users
  
  if (!email) {
    return NextResponse.json({ error: '請提供 email 參數' }, { status: 400 });
  }
  
  try {
    const db = getFirestore();
    const deleted: any = {
      users: 0,
      accounts: 0,
      profiles: 0,
      sessions: 0,
      waitlist: 0
    };
    
    if (type === 'all' || type === 'users') {
      // 刪除 users
      const usersQuery = await db.collection('users')
        .where('email', '==', email)
        .get();
      
      for (const doc of usersQuery.docs) {
        await doc.ref.delete();
        deleted.users++;
      }
    }
    
    if (type === 'all' || type === 'accounts') {
      // 刪除相關 accounts
      const usersQuery = await db.collection('users')
        .where('email', '==', email)
        .get();
      
      const accountsQuery = await db.collection('accounts').get();
      for (const doc of accountsQuery.docs) {
        const data = doc.data();
        if (data.userId === email || 
            usersQuery.docs.some(userDoc => userDoc.id === data.userId)) {
          await doc.ref.delete();
          deleted.accounts++;
        }
      }
    }
    
    if (type === 'all') {
      // 刪除 profile
      const profileRef = db.collection('profiles').doc(email);
      const profileDoc = await profileRef.get();
      if (profileDoc.exists) {
        await profileRef.delete();
        deleted.profiles++;
      }
      
      // 刪除 sessions
      const sessionsQuery = await db.collection('sessions')
        .where('userId', '==', email)
        .get();
      
      for (const doc of sessionsQuery.docs) {
        await doc.ref.delete();
        deleted.sessions++;
      }
      
      // 刪除 waitlist
      const waitlistQuery = await db.collection('waitlist')
        .where('email', '==', email)
        .get();
      
      for (const doc of waitlistQuery.docs) {
        await doc.ref.delete();
        deleted.waitlist++;
      }
    }
    
    return NextResponse.json({ 
      message: '清理完成',
      deleted 
    });
  } catch (error) {
    console.error('清理失敗:', error);
    return NextResponse.json({ error: '清理失敗' }, { status: 500 });
  }
}