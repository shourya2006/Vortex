const express = require("express");
const router = express.Router();

// Course configuration with Newton School API mappings
const COURSES = {
  SEM1: {
    name: "Semester 1",
    subjects: [
      {
        id: "math1",
        name: "Mathematics I",
        slug: "nzwmtdd1ktye",
      },
      {
        id: "psp",
        name: "Problem Solving with Python",
        slug: "cw8jd8q33uv9",
      },
      {
        id: "snw",
        name: "System and Web Essentials",
        slug: "wrskwgrpxjgu",
      },
    ],
  },
  SEM2: {
    name: "Semester 2",
    subjects: [
      {
        id: "dsa",
        name: "Data Structures and Algorithms",
        slug: "ah5qi2u9urrt",
      },
      {
        id: "wap",
        name: "Web Application Programming",
        slug: "zqg6ta3917k0",
      },
      {
        id: "math2",
        name: "Mathematics II",
        slug: "x0n0l9p7wnzr",
      },
    ],
  },
  SEM3: {
    name: "Semester 3",
    subjects: [
      {
        id: "ada",
        name: "Analysis and Design of Algorithms",
        slugs: ["71w36ui55vki", "5yr840e54q5a"],
      },
      {
        id: "ap",
        name: "Advance Programming",
        slugs: ["9qlmemzzpt6b", "p0f65o4fjzji"],
      },
      {
        id: "dbms",
        name: "Database Management Systems",
        slugs: ["6addtk39hy8c", "ico8pvge0zhd"],
      },
      {
        id: "math3",
        name: "Mathematics III",
        slugs: ["yai5rx2h6q6k", "c7134jweubad"],
      },
    ],
  },
  SEM4: {
    name: "Semester 4",
    subjects: [
      {
        id: "dm",
        name: "Discrete Mathematics",
        slug: "ok58b70d78xa",
      },
      {
        id: "dva",
        name: "Data and Visual Analytics",
        slug: "c6c54c31a81s",
      },
      {
        id: "genai",
        name: "Intro to Gen AI",
        slug: "o781u1d61228",
      },
      {
        id: "sdse",
        name: "System Design",
        slug: "f52au2c8qoqs",
      },
    ],
  },
};

// GET /api/courses/:semesterId - Get subjects for a semester
router.get("/:semesterId", (req, res) => {
  const { semesterId } = req.params;
  const semester = COURSES[semesterId.toUpperCase()];

  if (!semester) {
    return res.status(404).json({ error: "Semester not found" });
  }

  res.json({
    success: true,
    semester: {
      id: semesterId.toUpperCase(),
      name: semester.name,
      subjects: semester.subjects.map((s) => ({
        id: s.id,
        name: s.name,
      })),
    },
  });
});

module.exports = router;
