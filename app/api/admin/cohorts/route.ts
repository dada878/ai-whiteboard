import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../config/firebase-admin';
import { CohortAnalyticsService } from '../../../services/cohortAnalyticsService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const startWeek = searchParams.get('startWeek');
    const endWeek = searchParams.get('endWeek');
    const cohortWeek = searchParams.get('cohortWeek');

    console.log('Cohort API called with:', { action, startWeek, endWeek, cohortWeek });

    switch (action) {
      case 'summaries':
        // 獲取多個群組摘要
        if (!startWeek || !endWeek) {
          return NextResponse.json(
            { error: 'startWeek and endWeek are required for summaries' },
            { status: 400 }
          );
        }
        
        const summaries = await CohortAnalyticsService.getCohortSummaries(startWeek, endWeek);
        return NextResponse.json({ summaries });

      case 'summary':
        // 獲取單一群組摘要
        if (!cohortWeek) {
          return NextResponse.json(
            { error: 'cohortWeek is required for summary' },
            { status: 400 }
          );
        }
        
        const summary = await CohortAnalyticsService.getCohortSummary(cohortWeek);
        return NextResponse.json({ summary });

      case 'calculate':
        // 重新計算群組摘要
        if (!cohortWeek) {
          return NextResponse.json(
            { error: 'cohortWeek is required for calculate' },
            { status: 400 }
          );
        }
        
        const calculatedSummary = await CohortAnalyticsService.calculateCohortSummary(cohortWeek);
        return NextResponse.json({ summary: calculatedSummary });

      case 'recent-weeks':
        // 獲取最近的群組週列表
        const count = parseInt(searchParams.get('count') || '8');
        const recentWeeks = CohortAnalyticsService.getRecentCohortWeeks(count);
        return NextResponse.json({ weeks: recentWeeks });

      case 'user-data':
        // 獲取特定群組的用戶詳細數據
        if (!cohortWeek) {
          return NextResponse.json(
            { error: 'cohortWeek is required for user-data' },
            { status: 400 }
          );
        }

        const usersQuery = adminDb.collection('weekly_cohorts')
          .where('cohortWeek', '==', cohortWeek);
        
        const usersSnapshot = await usersQuery.get();
        const users = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        return NextResponse.json({ users, totalUsers: users.length });

      case 'retention-funnel':
        // 獲取留存漏斗數據
        if (!cohortWeek) {
          return NextResponse.json(
            { error: 'cohortWeek is required for retention-funnel' },
            { status: 400 }
          );
        }

        const funnelQuery = adminDb.collection('weekly_cohorts')
          .where('cohortWeek', '==', cohortWeek);
        
        const funnelSnapshot = await funnelQuery.get();
        const funnelUsers = funnelSnapshot.docs.map(doc => doc.data());
        
        const totalUsers = funnelUsers.length;
        const retentionFunnel = {
          week0: totalUsers,
          week1: funnelUsers.filter(u => u.week1Retention).length,
          week2: funnelUsers.filter(u => u.week2Retention).length,
          week3: funnelUsers.filter(u => u.week3Retention).length,
          week4: funnelUsers.filter(u => u.week4Retention).length,
        };

        return NextResponse.json({ 
          cohortWeek,
          totalUsers,
          retentionFunnel,
          retentionRates: {
            week1: totalUsers > 0 ? (retentionFunnel.week1 / totalUsers) * 100 : 0,
            week2: totalUsers > 0 ? (retentionFunnel.week2 / totalUsers) * 100 : 0,
            week3: totalUsers > 0 ? (retentionFunnel.week3 / totalUsers) * 100 : 0,
            week4: totalUsers > 0 ? (retentionFunnel.week4 / totalUsers) * 100 : 0,
          }
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: summaries, summary, calculate, recent-weeks, user-data, retention-funnel' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Cohort API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, signupDate, activityData } = body;

    console.log('Cohort POST API called with:', { action, userId, signupDate, activityData });

    switch (action) {
      case 'add-user':
        // 將用戶加入群組
        if (!userId || !signupDate) {
          return NextResponse.json(
            { error: 'userId and signupDate are required' },
            { status: 400 }
          );
        }
        
        await CohortAnalyticsService.addUserToCohort(userId, new Date(signupDate));
        return NextResponse.json({ success: true, message: 'User added to cohort' });

      case 'update-activity':
        // 更新用戶活動
        if (!userId || !activityData) {
          return NextResponse.json(
            { error: 'userId and activityData are required' },
            { status: 400 }
          );
        }
        
        await CohortAnalyticsService.updateUserActivity(userId, {
          ...activityData,
          activityDate: new Date(activityData.activityDate)
        });
        return NextResponse.json({ success: true, message: 'User activity updated' });

      case 'recalculate-all':
        // 重新計算所有群組摘要
        const weeks = CohortAnalyticsService.getRecentCohortWeeks(12);
        const results = [];
        
        for (const week of weeks) {
          try {
            const summary = await CohortAnalyticsService.calculateCohortSummary(week);
            results.push({ week, success: !!summary });
          } catch (error) {
            results.push({ week, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
          }
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Recalculation completed',
          results 
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: add-user, update-activity, recalculate-all' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Cohort POST API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}