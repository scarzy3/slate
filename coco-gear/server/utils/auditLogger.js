import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Log an action to the audit log
 * @param {string} action - checkout, return, inspect, maintenance_start, etc
 * @param {string} target - kit, asset, consumable, user
 * @param {string|null} targetId - ID of the target entity
 * @param {string|null} userId - ID of the user performing the action
 * @param {object} details - Additional details
 */
export async function auditLog(action, target, targetId, userId, details = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        target,
        targetId,
        userId,
        details,
        date: new Date(),
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

export default auditLog;
