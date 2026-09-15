export type Choice = {
  id: string;
  label: string;
};

export type Situation = {
  id: string;
  title: string;
  body: string;
  choices: Choice[];
};

export type Session = {
  id: string;
  name: string;
  accepting_choices: boolean;
  situations: Situation[];
};

export type Submission = {
  session_id: string;
  situation_id: string;
  choice_id: string;
  request_key: string;
};

export type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

