const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

export interface Subject {
  id: string;
  name: string;
}

export interface Semester {
  id: string;
  name: string;
  subjects: Subject[];
}

export interface CoursesResponse {
  success: boolean;
  semester: Semester;
}

export const coursesApi = {
  async getSubjects(semesterId: string): Promise<CoursesResponse> {
    const response = await fetch(`${API_BASE}/api/courses/${semesterId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.json();
  },
};
