export type CourseDay = {
  id: string;
  day_number: number;
  topic_name: string;
  pdf_url: string;
  pdf_unlock_at: string;
  quiz_unlock_at: string;
};

export type Attempt = {
  id: string;
  student_id: string;
  course_day_id: string;
  score: number;
  total: number;
  taken_at: string;
};

export type QuizQuestion = {
  id: string;
  course_day_id: string;
  question_order: number;
  question_text: string;
  options: string[];
  correct_index: number;
};

export type Profile = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
};
