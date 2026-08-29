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
}) {
  return {
    completedWordIds: progress.completedWordIds,
    completedDayNumbers: progress.completedDayNumbers,
  };
}

router.get("/progress", requireUser, async (_req, res): Promise<void> => {
  const progress = await db.query.userProgressTable.findFirst({
    where: eq(userProgressTable.userId, res.locals.userId),
  });

  res.json(GetProgressResponse.parse(
    serializeProgress(progress ?? { completedWordIds: [], completedDayNumbers: [] }),
  ));
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

  const [progress] = await db
    .insert(userProgressTable)
    .values({
      userId: res.locals.userId,
      completedWordIds: parsed.data.completedWordIds,
      completedDayNumbers: parsed.data.completedDayNumbers,
    })
    .onConflictDoUpdate({
      target: userProgressTable.userId,
      set: {
        completedWordIds: parsed.data.completedWordIds,
        completedDayNumbers: parsed.data.completedDayNumbers,
        updatedAt: new Date(),
      },
    })
    .returning({
      completedWordIds: userProgressTable.completedWordIds,
      completedDayNumbers: userProgressTable.completedDayNumbers,
    });

  res.json(SaveProgressResponse.parse(serializeProgress(progress)));
});

export default router;