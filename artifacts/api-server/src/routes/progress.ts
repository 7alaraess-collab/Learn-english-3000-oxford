import { Router, type NextFunction, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, userProgressTable } from "@workspace/db";
import {
  GetProgressResponse,
  SaveProgressBody,
  SaveProgressResponse,
} from "@workspace/api-zod";

const router = Router();
const dailyTestModes = new Set(["word-building", "multiple-choice", "matching"]);

function getTestCompletedDayNumbers(testResults: Record<string, { modes: string[] }>) {
  return Object.entries(testResults)
    .map(([key, result]) => {
      const match = /^daily-(\d+)$/.exec(key);
      if (!match || !result.modes.some((mode) => dailyTestModes.has(mode))) return null;
      const dayNumber = Number(match[1]);
      return Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= 300 ? dayNumber : null;
    })
    .filter((dayNumber): dayNumber is number => dayNumber !== null);
}

function requireUser(req: Request, res: Response, next: NextFunction) {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  res.locals.userId = userId;
  next();
}

function serializeProgress(progress: {
  completedWordIds: number[];
  completedDayNumbers: number[];
  reviewDates: Record<string, string>;
  reviewMilestones: Record<string, string>;
  starredWordIds: number[];
  currentDayNumber: number | null;
  currentWordId: number | null;
  testResults: Record<string, {
    completedAt: string;
    score: number;
    total: number;
    modes: string[];
  }>;
}) {
  return {
    completedWordIds: progress.completedWordIds,
    completedDayNumbers: [...new Set([
      ...progress.completedDayNumbers,
      ...getTestCompletedDayNumbers(progress.testResults),
    ])].sort((a, b) => a - b),
    reviewDates: progress.reviewDates,
    reviewMilestones: progress.reviewMilestones,
    starredWordIds: progress.starredWordIds,
    currentDayNumber: progress.currentDayNumber,
    currentWordId: progress.currentWordId,
    testResults: progress.testResults,
  };
}

router.get("/progress", requireUser, async (_req, res): Promise<void> => {
  const progress = await db.query.userProgressTable.findFirst({
    where: eq(userProgressTable.userId, res.locals.userId),
  });

  res.json(GetProgressResponse.parse(serializeProgress(progress ?? {
    completedWordIds: [],
    completedDayNumbers: [],
    reviewDates: {},
    reviewMilestones: {},
    starredWordIds: [],
    currentDayNumber: null,
    currentWordId: null,
    testResults: {},
  })));
});

router.put("/progress", requireUser, async (req, res): Promise<void> => {
  const parsed = SaveProgressBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Progress payload is invalid",
      issues: parsed.error.flatten(),
    });
    return;
  }

  const completedDayNumbers = [...new Set([
    ...parsed.data.completedDayNumbers,
    ...getTestCompletedDayNumbers(parsed.data.testResults),
  ])].sort((a, b) => a - b);
  const [progress] = await db
    .insert(userProgressTable)
    .values({
      userId: res.locals.userId,
      completedWordIds: parsed.data.completedWordIds,
      completedDayNumbers,
      reviewDates: parsed.data.reviewDates,
      reviewMilestones: parsed.data.reviewMilestones,
      starredWordIds: parsed.data.starredWordIds,
      currentDayNumber: parsed.data.currentDayNumber,
      currentWordId: parsed.data.currentWordId,
      testResults: parsed.data.testResults,
    })
    .onConflictDoUpdate({
      target: userProgressTable.userId,
      set: {
        completedWordIds: parsed.data.completedWordIds,
        completedDayNumbers,
        reviewDates: parsed.data.reviewDates,
        reviewMilestones: parsed.data.reviewMilestones,
        starredWordIds: parsed.data.starredWordIds,
        currentDayNumber: parsed.data.currentDayNumber,
        currentWordId: parsed.data.currentWordId,
        testResults: parsed.data.testResults,
        updatedAt: new Date(),
      },
    })
    .returning({
      completedWordIds: userProgressTable.completedWordIds,
      completedDayNumbers: userProgressTable.completedDayNumbers,
      reviewDates: userProgressTable.reviewDates,
      reviewMilestones: userProgressTable.reviewMilestones,
      starredWordIds: userProgressTable.starredWordIds,
      currentDayNumber: userProgressTable.currentDayNumber,
      currentWordId: userProgressTable.currentWordId,
      testResults: userProgressTable.testResults,
    });

  res.json(SaveProgressResponse.parse(serializeProgress(progress)));
});

export default router;