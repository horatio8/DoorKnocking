import type { SurveyQuestionDraft } from "./types";

// Starter survey templates (§5.5). Each questions array is ordered and carries
// stable question_keys so a seeded survey is immediately publishable.

export interface SurveyTemplate {
  key: string;
  name: string;
  description: string;
  questions: Omit<SurveyQuestionDraft, "order_index">[];
}

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    key: "voter_id",
    name: "Voter ID",
    description: "Party lean, candidate support, turnout likelihood.",
    questions: [
      {
        question_key: "party_lean",
        question_text: "Which party do you lean toward?",
        question_type: "single_choice",
        required: true,
        help_text: null,
        min_value: null,
        max_value: null,
        options: [
          { value: "democrat", label: "Democrat" },
          { value: "republican", label: "Republican" },
          { value: "independent", label: "Independent" },
          { value: "other", label: "Other / decline" },
        ],
      },
      {
        question_key: "support_level",
        question_text: "How would you describe your support for our candidate?",
        question_type: "single_choice",
        required: true,
        help_text: null,
        min_value: null,
        max_value: null,
        options: [
          { value: "strong", label: "Strong support" },
          { value: "leaning", label: "Leaning support" },
          { value: "undecided", label: "Undecided" },
          { value: "leaning_opp", label: "Leaning opponent" },
          { value: "strong_opp", label: "Strong opponent" },
        ],
      },
      {
        question_key: "turnout_likelihood",
        question_text: "How likely are you to vote in the next election? (0–10)",
        question_type: "scale_0_10",
        required: true,
        help_text: null,
        options: null,
        min_value: 0,
        max_value: 10,
      },
    ],
  },
  {
    key: "issue_priority",
    name: "Issue Priority",
    description: "Ranked top issues for this voter.",
    questions: [
      {
        question_key: "top_issue",
        question_text: "What's the most important issue for your family?",
        question_type: "single_choice",
        required: true,
        help_text: null,
        min_value: null,
        max_value: null,
        options: [
          { value: "education", label: "Education" },
          { value: "economy", label: "Economy" },
          { value: "healthcare", label: "Healthcare" },
          { value: "public_safety", label: "Public safety" },
          { value: "environment", label: "Environment" },
          { value: "other", label: "Something else" },
        ],
      },
      {
        question_key: "issue_detail",
        question_text: "Anything else you want to share about that issue?",
        question_type: "long_text",
        required: false,
        help_text: "Optional — it helps us pass along your concerns.",
        options: null,
        min_value: null,
        max_value: null,
      },
    ],
  },
  {
    key: "persuasion",
    name: "Candidate Persuasion",
    description: "Before / after support + commitment.",
    questions: [
      {
        question_key: "support_before",
        question_text: "Before today, how strongly did you support our candidate? (1–5)",
        question_type: "rating_1_5",
        required: true,
        help_text: null,
        options: null,
        min_value: 1,
        max_value: 5,
      },
      {
        question_key: "persuade_issue",
        question_text: "What matters most to you in choosing a candidate?",
        question_type: "short_text",
        required: false,
        help_text: null,
        options: null,
        min_value: null,
        max_value: null,
      },
      {
        question_key: "support_after",
        question_text: "After our conversation, how strongly do you support our candidate? (1–5)",
        question_type: "rating_1_5",
        required: true,
        help_text: null,
        options: null,
        min_value: 1,
        max_value: 5,
      },
      {
        question_key: "will_talk_to_friends",
        question_text: "Would you talk to friends or neighbours about our campaign?",
        question_type: "yes_no",
        required: false,
        help_text: null,
        options: null,
        min_value: null,
        max_value: null,
      },
    ],
  },
  {
    key: "gotv",
    name: "GOTV",
    description: "Will-you-vote commitment + voting plan.",
    questions: [
      {
        question_key: "will_vote",
        question_text: "Are you planning to vote in the upcoming election?",
        question_type: "yes_no",
        required: true,
        help_text: null,
        options: null,
        min_value: null,
        max_value: null,
      },
      {
        question_key: "vote_method",
        question_text: "How do you plan to vote?",
        question_type: "single_choice",
        required: false,
        help_text: null,
        min_value: null,
        max_value: null,
        options: [
          { value: "in_person_election_day", label: "In-person on Election Day" },
          { value: "early_in_person", label: "Early in-person" },
          { value: "absentee_mail", label: "Absentee / mail" },
          { value: "not_sure", label: "Not sure yet" },
        ],
      },
      {
        question_key: "vote_day_commitment",
        question_text: "Which day are you most likely to cast your ballot?",
        question_type: "short_text",
        required: false,
        help_text: "Optional — helps us plan reminders.",
        options: null,
        min_value: null,
        max_value: null,
      },
    ],
  },
];
