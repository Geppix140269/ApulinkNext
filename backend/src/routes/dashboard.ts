// src/routes/dashboard.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { db as firebaseDb } from '../config/firebase';

const router = Router();
const prisma = new PrismaClient();

// Get comprehensive dashboard data
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get projects with all related data
    const projects = await prisma.project.findMany({
      where: { ownerId: userId },
      include: {
        milestones: {
          orderBy: { dueDate: 'asc' },
          take: 5,
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        teamMembers: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    // Get insights from Firebase
    const insightsSnapshot = await firebaseDb
      .collection('dailyInsights')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    
    const insights = insightsSnapshot.docs[0]?.data() || {};

    // Calculate dashboard metrics
    const metrics = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'active').length,
      averageHealth: projects.reduce((sum, p) => sum + p.healthScore, 0) / projects.length || 0,
      upcomingDeadlines: projects.flatMap(p => 
        p.milestones.filter(m => 
          m.status !== 'completed' && 
          new Date(m.dueDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        )
      ).length,
      totalBudget: projects.reduce((sum, p) => sum + Number(p.budgetTotal || 0), 0),
      totalSpent: projects.reduce((sum, p) => 
        sum + p.transactions.reduce((tSum, t) => tSum + Number(t.amount), 0), 0
      ),
    };

    // Get today's focus items
    const todaysFocus = await generateTodaysFocus(userId, projects);

    res.json({
      metrics,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        healthScore: p.healthScore,
        status: p.status,
        upcomingMilestones: p.milestones.slice(0, 3),
        recentActivity: p.activities[0],
        teamSize: p.teamMembers.length,
        budgetUtilization: p.budgetTotal 
          ? (p.transactions.reduce((sum, t) => sum + Number(t.amount), 0) / Number(p.budgetTotal)) * 100
          : 0,
      })),
      todaysFocus,
      insights,
      recentActivities: projects.flatMap(p => p.activities)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// AI-powered focus generator
async function generateTodaysFocus(userId: string, projects: any[]) {
  const focusItems = [];

  // Priority 1: Overdue items
  for (const project of projects) {
    const overdueMilestones = project.milestones.filter(
      (m: any) => m.status !== 'completed' && new Date(m.dueDate) < new Date()
    );
    
    for (const milestone of overdueMilestones) {
      focusItems.push({
        priority: 'urgent',
        type: 'milestone',
        action: `Complete overdue milestone: ${milestone.title}`,
        projectId: project.id,
        projectName: project.name,
        metadata: milestone,
      });
    }
  }

  // Priority 2: Due today/tomorrow
  for (const project of projects) {
    const soonMilestones = project.milestones.filter((m: any) => {
      const dueDate = new Date(m.dueDate);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      return m.status !== 'completed' && dueDate <= tomorrow && dueDate >= new Date();
    });
    
    for (const milestone of soonMilestones) {
      focusItems.push({
        priority: 'high',
        type: 'milestone',
        action: `${milestone.title} due soon`,
        projectId: project.id,
        projectName: project.name,
        metadata: milestone,
      });
    }
  }

  // Priority 3: Low health projects
  const lowHealthProjects = projects.filter(p => p.healthScore < 70);
  for (const project of lowHealthProjects) {
    focusItems.push({
      priority: 'medium',
      type: 'health',
      action: `Review project health: ${project.name} (${project.healthScore}%)`,
      projectId: project.id,
      projectName: project.name,
      metadata: { healthScore: project.healthScore },
    });
  }

  // Sort by priority and return top 5
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  return focusItems
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 5);
}

export default router;