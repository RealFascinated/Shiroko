import Components from "@/component/components";
import { db } from "@/db/index";
import { triviaGuessesSchema, type TriviaGuessSchema } from "@/db/schemas/trivia-guesses";
import { fetchJson } from "@/lib/fetch";
import { asc, eq } from "drizzle-orm";

// Image questions need an API key and cannot be answered with button labels.
const API_URL = "https://the-trivia-api.com/v2/questions?limit=1&types=text_choice";

export type TriviaDifficulty = "easy" | "medium" | "hard";

export const TRIVIA_CATEGORIES = {
  arts_and_literature: "Arts & Literature",
  film_and_tv: "Film & TV",
  food_and_drink: "Food & Drink",
  general_knowledge: "General Knowledge",
  geography: "Geography",
  history: "History",
  music: "Music",
  science: "Science",
  society_and_culture: "Society & Culture",
  sport_and_leisure: "Sport & Leisure",
} as const;

export type TriviaCategory = keyof typeof TRIVIA_CATEGORIES;

interface ApiResponseEntry {
  category: TriviaCategory;
  question: { text: string };
  correctAnswer: string;
  incorrectAnswers: string[];
  difficulty: TriviaDifficulty;
  hint?: string;
  explanation?: string;
}

export type TriviaQuestion = {
  question: string;
  category: string;
  difficulty: TriviaDifficulty;
  /** Shuffled; exactly one entry equals the answer named by `correctIndex`. */
  answers: string[];
  correctIndex: number;
  hint: string | null;
  explanation: string | null;
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export default class TriviaService {
  public static async fetchQuestion(
    difficulty: TriviaDifficulty | null,
    category: TriviaCategory | null
  ): Promise<TriviaQuestion> {
    const params = new URLSearchParams();
    if (difficulty !== null) {
      params.set("difficulties", difficulty);
    }
    if (category !== null) {
      params.set("categories", category);
    }
    const [raw] = await fetchJson<ApiResponseEntry[]>(`${API_URL}&${params}`);
    if (raw === undefined) {
      throw new Error("The Trivia API returned no questions");
    }

    const answers = shuffle([raw.correctAnswer, ...raw.incorrectAnswers]);
    return {
      question: raw.question.text,
      category: TRIVIA_CATEGORIES[raw.category] ?? raw.category,
      difficulty: raw.difficulty,
      answers,
      correctIndex: answers.indexOf(raw.correctAnswer),
      hint: raw.hint ?? null,
      explanation: raw.explanation ?? null,
    };
  }

  public static async guess(gameId: string, userId: string, answerIndex: number): Promise<boolean> {
    const rows = await db
      .insert(triviaGuessesSchema)
      .values({ gameId, userId, answerIndex })
      .onConflictDoNothing()
      .returning({ userId: triviaGuessesSchema.userId });
    return rows.length > 0;
  }

  /**
   * End a question and return its guesses in press order, or null when a
   * correct press and the timeout raced and the other side already ended it.
   * The guesses are read before the buttons are dropped, since dropping the
   * game's row cascades them away.
   */
  public static async end(gameId: string, messageId: string): Promise<TriviaGuessSchema[] | null> {
    const guesses = await db
      .select()
      .from(triviaGuessesSchema)
      .where(eq(triviaGuessesSchema.gameId, gameId))
      .orderBy(asc(triviaGuessesSchema.createdAt));
    const dropped = await Components.deleteByMessage(messageId);
    return dropped.length > 0 ? guesses : null;
  }
}
