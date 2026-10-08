export type Gender = "male" | "female";

export type CivilTime = {
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute: number;
};

export type Place = {
  name: string;
  longitude: number;
  latitude: number;
  timezone: number;
};

export type Person = {
  id: string;
  name: string;
  gender: Gender;
  time: CivilTime;
  place: Place;
  hourUnknown: boolean;
  mbti?: string | null;
};
