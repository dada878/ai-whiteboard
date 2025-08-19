// 修復 account linking 錯誤的腳本
// 使用方式: node scripts/fix-account-linking.js email@example.com

const admin = require('firebase-admin');

// 手動設定環境變數
process.env.FIREBASE_PROJECT_ID = 'onyx-goal-334712';
process.env.FIREBASE_CLIENT_EMAIL = 'firebase-adminsdk-kxtwz@onyx-goal-334712.iam.gserviceaccount.com';

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

async function checkAndFixAccount(email) {
  if (!email) {
    console.error('請提供 email 參數');
    console.log('使用方式: node scripts/fix-account-linking.js your-email@example.com');
    process.exit(1);
  }

  console.log(`\n🔍 檢查帳號: ${email}\n`);

  try {
    // 1. 檢查 users collection
    console.log('1. 檢查 users collection...');
    const usersQuery = await db.collection('users')
      .where('email', '==', email)
      .get();
    
    console.log(`   找到 ${usersQuery.size} 個 user 文檔`);
    usersQuery.forEach(doc => {
      console.log(`   - ID: ${doc.id}`);
      const data = doc.data();
      console.log(`     Name: ${data.name}, Created: ${data.createdAt}`);
    });

    // 2. 檢查 accounts collection
    console.log('\n2. 檢查 accounts collection...');
    const accountsQuery = await db.collection('accounts').get();
    const relatedAccounts = [];
    
    accountsQuery.forEach(doc => {
      const data = doc.data();
      // 檢查各種可能的關聯
      if (data.userId === email || 
          data.providerAccountId === email ||
          usersQuery.docs.some(userDoc => 
            userDoc.id === data.userId || 
            userDoc.data().id === data.userId
          )) {
        relatedAccounts.push({ id: doc.id, ...data });
      }
    });
    
    console.log(`   找到 ${relatedAccounts.length} 個相關 account 文檔`);
    relatedAccounts.forEach(acc => {
      console.log(`   - Provider: ${acc.provider}, UserID: ${acc.userId}`);
    });

    // 3. 檢查 sessions collection
    console.log('\n3. 檢查 sessions collection...');
    const sessionsQuery = await db.collection('sessions')
      .where('userId', '==', email)
      .get();
    
    console.log(`   找到 ${sessionsQuery.size} 個 session 文檔`);

    // 4. 檢查 profiles collection
    console.log('\n4. 檢查 profiles collection...');
    const profileDoc = await db.collection('profiles').doc(email).get();
    
    if (profileDoc.exists) {
      console.log('   ✅ Profile 存在');
      const data = profileDoc.data();
      console.log(`     Approved: ${data.isApproved}, Plan: ${data.plan}`);
    } else {
      console.log('   ❌ Profile 不存在');
    }

    // 5. 提供修復選項
    console.log('\n====================================');
    console.log('修復選項:');
    console.log('====================================\n');
    
    if (relatedAccounts.length > 0 || usersQuery.size > 0) {
      console.log('發現可能的衝突！建議執行以下操作：\n');
      console.log('1. 清理所有相關資料（完全重置）:');
      console.log(`   node scripts/fix-account-linking.js ${email} --clean-all\n`);
      
      console.log('2. 只清理 accounts（保留用戶資料）:');
      console.log(`   node scripts/fix-account-linking.js ${email} --clean-accounts\n`);
      
      console.log('3. 手動檢查 Firebase Console:');
      console.log(`   https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID}/firestore\n`);
    } else {
      console.log('✅ 沒有發現明顯的衝突。');
      console.log('可能是暫時性問題，請再試一次登入。');
    }

    // 執行清理操作
    const action = process.argv[3];
    
    if (action === '--clean-all') {
      console.log('\n🧹 執行完全清理...\n');
      
      // 刪除所有相關 accounts
      for (const acc of relatedAccounts) {
        await db.collection('accounts').doc(acc.id).delete();
        console.log(`   ✅ 刪除 account: ${acc.id}`);
      }
      
      // 刪除所有相關 users
      for (const doc of usersQuery.docs) {
        await doc.ref.delete();
        console.log(`   ✅ 刪除 user: ${doc.id}`);
      }
      
      // 刪除 profile
      if (profileDoc.exists) {
        await profileDoc.ref.delete();
        console.log(`   ✅ 刪除 profile: ${email}`);
      }
      
      // 刪除所有 sessions
      for (const doc of sessionsQuery.docs) {
        await doc.ref.delete();
        console.log(`   ✅ 刪除 session: ${doc.id}`);
      }
      
      console.log('\n✨ 清理完成！現在可以重新登入了。');
      
    } else if (action === '--clean-accounts') {
      console.log('\n🧹 只清理 accounts...\n');
      
      // 只刪除 accounts
      for (const acc of relatedAccounts) {
        await db.collection('accounts').doc(acc.id).delete();
        console.log(`   ✅ 刪除 account: ${acc.id}`);
      }
      
      console.log('\n✨ Accounts 清理完成！現在可以重新登入了。');
    }
    
  } catch (error) {
    console.error('\n❌ 發生錯誤:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// 獲取命令行參數
const email = process.argv[2];
checkAndFixAccount(email);