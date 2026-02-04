const express = require("express");
const router = express.Router();
const {
  fetchLecturesForCourse,
  filterLecturesWithContent,
  getUnprocessedLectures,
  markLectureAsProcessed,
  getSyncStatus,
} = require("../services/lectureSync");
const { processDocument } = require("../services/pdfService");
const { generateEmbeddings } = require("../services/vectorService");
const { upsertVectors } = require("../services/pineconeService");

router.post("/:courseSlug", async (req, res) => {
  const { courseSlug } = req.params;

  try {
    console.log(`[Sync] Starting sync for course: ${courseSlug}`);

    const allLectures = await fetchLecturesForCourse(courseSlug);
    console.log(`[Sync] Found ${allLectures.length} total lectures`);

    const lecturesWithContent = await filterLecturesWithContent(allLectures);
    console.log(`[Sync] ${lecturesWithContent.length} lectures have content`);

    const unprocessedLectures =
      await getUnprocessedLectures(lecturesWithContent);
    console.log(`[Sync] ${unprocessedLectures.length} new lectures to process`);

    if (unprocessedLectures.length === 0) {
      return res.json({
        success: true,
        message: "All lectures already processed",
        stats: {
          total: allLectures.length,
          withContent: lecturesWithContent.length,
          newlyProcessed: 0,
        },
      });
    }

    const results = [];

    for (const lecture of unprocessedLectures) {
      try {
        console.log(`\n[Sync] Processing: ${lecture.title} (${lecture.hash})`);

        const chunks = await processDocument(lecture.whiteboard_file);

        if (chunks.length === 0) {
          console.log(`[Sync] No content extracted, skipping`);
          continue;
        }

        const embeddings = await generateEmbeddings(chunks);

        const vectorCount = await upsertVectors(
          lecture.hash,
          chunks,
          embeddings,
          {
            title: lecture.title,
            course: lecture.course?.short_display_name || "Unknown",
          },
        );

        await markLectureAsProcessed(lecture, vectorCount);

        results.push({
          hash: lecture.hash,
          title: lecture.title,
          vectorCount: vectorCount,
          success: true,
        });

        console.log(`[Sync] ✅ Completed: ${lecture.title}`);
      } catch (error) {
        console.error(`[Sync] ❌ Failed: ${lecture.title}`, error.message);
        results.push({
          hash: lecture.hash,
          title: lecture.title,
          success: false,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${results.filter((r) => r.success).length} lectures`,
      stats: {
        total: allLectures.length,
        withContent: lecturesWithContent.length,
        newlyProcessed: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
      results: results,
    });
  } catch (error) {
    console.error("[Sync] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/status", async (req, res) => {
  try {
    const status = await getSyncStatus();
    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
