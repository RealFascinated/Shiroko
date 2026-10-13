import { fetchJson } from "@/lib/fetch";

const API_URL = "https://the-trivia-api.com/api/questions?limit=1";

interface ApiResponseEntry {
  category: string;
  question: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  difficulty: string;
}

export interface TriviaQuestion {
  question: string;
  category: string;
  difficulty: string;
  /** Shuffled; exactly one entry equals the answer named by `correctIndex`. */
  answers: string[];
  correctIndex: number;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export default class TriviaService {
  public static async fetchQuestion(): Promise<TriviaQuestion> {
    const [raw] = await fetchJson<ApiResponseEntry[]>(API_URL);
    if (raw === undefined) {
      throw new Error("The Trivia API returned no questions");
    }

    const answers = shuffle([raw.correctAnswer, ...raw.incorrectAnswers]);
    return {
      question: raw.question,
      category: raw.category,
      difficulty: raw.difficulty,
      answers,
      correctIndex: answers.indexOf(raw.correctAnswer),
    };
  }
}
