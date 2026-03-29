export type AdapterFixture = {
  label: string;
  text: string;
  editedText?: string;
};

export type AdapterFixtures = {
  urgent: AdapterFixture;
  normal: AdapterFixture;
  edited: AdapterFixture;
};

export const standardFixtures: AdapterFixtures = {
  urgent: {
    label: "urgent",
    text: "URGENT: production is down",
    editedText: "URGENT: production is still down",
  },
  normal: {
    label: "normal",
    text: "standup moved to 10:30",
    editedText: "standup moved to 11:00",
  },
  edited: {
    label: "edited",
    text: "draft status update",
    editedText: "final status update",
  },
};
