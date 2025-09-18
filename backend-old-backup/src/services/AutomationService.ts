// src/services/AutomationService.ts
import { PrismaClient } from '@prisma/client';
import { db as firebaseDb } from '../config/firebase';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

export class AutomationService extends EventEmitter {
  private checkInterval: NodeJS.Timer | null = null;

  constructor() {
    super();
    this.startAutomation();
  }

  startAutomation() {
    // Check every 5 minutes
    this.checkInterval = setInterval(() => {
      this.runAutomationChecks();
    }, 5 * 60 * 1000);
    
    console.log('🤖 Automation service started');
  }

  async runAutomationChecks() {
    await this.checkProjectHealth();
    await this.checkUpcomingDeadlines();
    await this.generateDailyInsights();
  }

  async checkProjectHealth() {
    try {
      const projects = await prisma.project.findMany({
        include: {
          milestones: true,
          transactions: true,
          teamMembers: true,
        },
      });

      for (const project of projects) {
        const healthScore = this.calculateHealthScore(project);
        
        // Update health score in PostgreSQL
        await prisma.project.update({
          where: { id: project.id },
          data: { healthScore },
        });

        // Store health history in Firebase
        await firebaseDb.collection('healthHistory').add({
          projectId: project.id,
          score: healthScore,
          timestamp: new Date(),
          factors: this.getHealthFactors(project),
        });

        // Emit event if health drops below threshold
        if (healthScore < 50) {
          this.emit('lowHealth', { projectId: project.id, score: healthScore });
        }
      }
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  calculateHealthScore(project: any): number {
    let score = 100;
    
    // Check overdue milestones
    const overdueMilestones = project.milestones.filter(
      (m: any) => m.status !== 'completed' && new Date(m.dueDate) < new Date()
    );
    score -= overdueMilestones.length * 10;

    // Check budget utilization
    const budgetUsed = project.transactions.reduce(
      (sum: number, t: any) => sum + Number(t.amount), 0
    );
    const budgetPercentage = project.budgetTotal 
      ? (budgetUsed / Number(project.budgetTotal)) * 100 
      : 0;
    
    if (budgetPercentage > 90) score -= 20;
    else if (budgetPercentage > 75) score -= 10;

    // Check team activity
    const recentActivity = project.teamMembers.filter(
      (m: any) => new Date(m.lastActive) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    
    if (recentActivity.length === 0) score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  getHealthFactors(project: any) {
    return {
      milestoneCompletion: this.getMilestoneCompletion(project),
      budgetHealth: this.getBudgetHealth(project),
      teamEngagement: this.getTeamEngagement(project),
      documentStatus: this.getDocumentStatus(project),
    };
  }

  getMilestoneCompletion(project: any): number {
    if (!project.milestones.length) return 100;
    const completed = project.milestones.filter((m: any) => m.status === 'completed');
    return Math.round((completed.length / project.milestones.length) * 100);
  }

  getBudgetHealth(project: any): number {
    if (!project.budgetTotal) return 100;
    const spent = project.transactions.reduce(
      (sum: number, t: any) => sum + Number(t.amount), 0
    );
    const percentage = (spent / Number(project.budgetTotal)) * 100;
    return Math.max(0, 100 - percentage);
  }

  getTeamEngagement(project: any): number {
    const activeMembers = project.teamMembers.filter(
      (m: any) => new Date(m.lastActive) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    );
    return project.teamMembers.length 
      ? Math.round((activeMembers.length / project.teamMembers.length) * 100)
      : 0;
  }

  getDocumentStatus(project: any): number {
    // This would check Firebase for document completion
    return 75; // Mock for now
  }

  async checkUpcomingDeadlines() {
    const upcomingMilestones = await prisma.milestone.findMany({
      where: {
        status: { not: 'completed' },
        dueDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
        },
      },
      include: {
        project: true,
      },
    });

    for (const milestone of upcomingMilestones) {
      const daysUntil = Math.ceil(
        (new Date(milestone.dueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );

      if (daysUntil <= 3) {
        this.emit('deadlineApproaching', {
          milestone,
          daysUntil,
          priority: daysUntil <= 1 ? 'urgent' : 'high',
        });
      }
    }
  }

  async generateDailyInsights() {
    const insights = {
      timestamp: new Date(),
      insights: [],
      recommendations: [],
    };

    // Add insights based on data analysis
    const projects = await prisma.project.findMany({
      include: { milestones: true, transactions: true },
    });

    for (const project of projects) {
      if (project.healthScore < 70) {
        insights.insights.push({
          type: 'warning',
          message: `Project "${project.name}" health is below optimal (${project.healthScore}%)`,
          projectId: project.id,
        });
      }

      // Budget warnings
      const budgetUsed = project.transactions.reduce(
        (sum: number, t: any) => sum + Number(t.amount), 0
      );
      
      if (project.budgetTotal && budgetUsed > Number(project.budgetTotal) * 0.8) {
        insights.recommendations.push({
          type: 'budget',
          message: `Review budget allocation for "${project.name}"`,
          projectId: project.id,
        });
      }
    }

    // Store insights in Firebase
    await firebaseDb.collection('dailyInsights').add(insights);
    
    this.emit('insightsGenerated', insights);
  }

  stopAutomation() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('🛑 Automation service stopped');
    }
  }
}

export const automationService = new AutomationService();