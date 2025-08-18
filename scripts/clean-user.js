// 清理特定用戶的腳本
// 使用方式: node scripts/clean-user.js email@example.com

const admin = require('firebase-admin');

// 初始化 Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();

async function cleanUser(email) {
  if (!email) {
    console.error('請提供 email 參數');
    process.exit(1);
  }

  console.log(`正在清理用戶: ${email}`);

  try {
    // 1. 刪除 users collection 中的文檔
    const userRef = db.collection('users').doc(email);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      await userRef.delete();
      console.log('✅ 已刪除 users 文檔');
    } else {
      console.log('ℹ️ users 文檔不存在');
    }

    // 2. 刪除 accounts collection 中的相關文檔
    const accountsQuery = await db.collection('accounts')
      .where('userId', '==', email)
      .get();
    
    if (!accountsQuery.empty) {
      for (const doc of accountsQuery.docs) {
        await doc.ref.delete();
        console.log(`✅ 已刪除 account 文檔: ${doc.id}`);
      }
    } else {
      console.log('ℹ️ 沒有找到相關的 accounts 文檔');
    }

    // 3. 刪除 sessions collection 中的相關文檔
    const sessionsQuery = await db.collection('sessions')
      .where('userId', '==', email)
      .get();
    
    if (!sessionsQuery.empty) {
      for (const doc of sessionsQuery.docs) {
        await doc.ref.delete();
        console.log(`✅ 已刪除 session 文檔: ${doc.id}`);
      }
    } else {
      console.log('ℹ️ 沒有找到相關的 sessions 文檔');
    }

    // 4. 刪除 waitlist 中的相關記錄
    const waitlistQuery = await db.collection('waitlist')
      .where('email', '==', email)
      .get();
    
    if (!waitlistQuery.empty) {
      for (const doc of waitlistQuery.docs) {
        await doc.ref.delete();
        console.log(`✅ 已刪除 waitlist 記錄: ${doc.id}`);
      }
    } else {
      console.log('ℹ️ 沒有找到相關的 waitlist 記錄');
    }

    console.log('\n✨ 清理完成！現在你可以重新登入了。');
    
  } catch (error) {
    console.error('清理過程中發生錯誤:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// 獲取命令行參數
const email = process.argv[2];
cleanUser(email);