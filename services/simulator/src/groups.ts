export type SimSender = {
  id: string;
  name: string;
};

export type SimGroup = {
  id: string;
  title: string;
  senders: SimSender[];
};

export const simulatorGroups: SimGroup[] = [
  {
    id: "grp_001",
    title: "ועד הורים כיתה ג",
    senders: [
      { id: "yael_001@lid", name: "יעל" },
      { id: "omer_001@lid", name: "עומר" },
      { id: "maya_001@lid", name: "מאיה" },
      { id: "ron_001@lid", name: "רון" },
    ],
  },
  {
    id: "grp_002",
    title: "שכנים רחוב הדקל",
    senders: [
      { id: "gil_002@lid", name: "גיל" },
      { id: "shira_002@lid", name: "Shira" },
      { id: "dani_002@lid", name: "דני" },
      { id: "lital_002@lid", name: "ליטל" },
    ],
  },
  {
    id: "grp_003",
    title: "קבוצת ריצה בוקר",
    senders: [
      { id: "nofar_003@lid", name: "נופר" },
      { id: "amit_003@lid", name: "Amit" },
      { id: "bar_003@lid", name: "בר" },
      { id: "liat_003@lid", name: "Liat" },
    ],
  },
  {
    id: "grp_004",
    title: "PTA Board",
    senders: [
      { id: "sarah_004@lid", name: "Sarah" },
      { id: "dan_004@lid", name: "Dan" },
      { id: "rachel_004@lid", name: "Rachel" },
      { id: "josh_004@lid", name: "Josh" },
    ],
  },
  {
    id: "grp_005",
    title: "Building Maintenance",
    senders: [
      { id: "eli_005@lid", name: "Eli" },
      { id: "moshe_005@lid", name: "משה" },
      { id: "tamar_005@lid", name: "Tamar" },
      { id: "noam_005@lid", name: "נועם" },
    ],
  },
  {
    id: "grp_006",
    title: "Youth Soccer Team",
    senders: [
      { id: "coach_006@lid", name: "Coach Ben" },
      { id: "adi_006@lid", name: "Adi" },
      { id: "nina_006@lid", name: "Nina" },
      { id: "ori_006@lid", name: "Ori" },
    ],
  },
  {
    id: "grp_007",
    title: "Book Club",
    senders: [
      { id: "mila_007@lid", name: "Mila" },
      { id: "yarden_007@lid", name: "ירדן" },
      { id: "lena_007@lid", name: "Lena" },
      { id: "dina_007@lid", name: "דינה" },
    ],
  },
  {
    id: "grp_008",
    title: "Family Updates",
    senders: [
      { id: "abba_008@lid", name: "אבא" },
      { id: "ima_008@lid", name: "אמא" },
      { id: "dana_008@lid", name: "Dana" },
      { id: "yoav_008@lid", name: "Yoav" },
    ],
  },
  {
    id: "grp_009",
    title: "Work Notices",
    senders: [
      { id: "hr_009@lid", name: "HR Team" },
      { id: "liran_009@lid", name: "לירן" },
      { id: "mike_009@lid", name: "Mike" },
      { id: "tal_009@lid", name: "Tal" },
    ],
  },
  {
    id: "grp_010",
    title: "Carpool Morning",
    senders: [
      { id: "hadas_010@lid", name: "הדס" },
      { id: "ronit_010@lid", name: "Ronit" },
      { id: "avi_010@lid", name: "Avi" },
      { id: "gal_010@lid", name: "גל" },
    ],
  },
  {
    id: "grp_011",
    title: "School Bus Parents",
    senders: [
      { id: "bus_011@lid", name: "Bus Admin" },
      { id: "maya_011@lid", name: "Maya" },
      { id: "erez_011@lid", name: "ארז" },
      { id: "lior_011@lid", name: "Lior" },
    ],
  },
  {
    id: "grp_012",
    title: "Neighborhood Watch",
    senders: [
      { id: "rami_012@lid", name: "רמי" },
      { id: "shani_012@lid", name: "Shani" },
      { id: "aviad_012@lid", name: "Aviad" },
      { id: "ella_012@lid", name: "Ella" },
    ],
  },
  {
    id: "grp_013",
    title: "Birthday Planning",
    senders: [
      { id: "nitzan_013@lid", name: "ניצן" },
      { id: "ella_013@lid", name: "Ella" },
      { id: "barak_013@lid", name: "Barak" },
      { id: "noa_013@lid", name: "Noa" },
    ],
  },
  {
    id: "grp_014",
    title: "Gym Buddies",
    senders: [
      { id: "stav_014@lid", name: "Stav" },
      { id: "eyal_014@lid", name: "Eyal" },
      { id: "shir_014@lid", name: "שיר" },
      { id: "omri_014@lid", name: "Omri" },
    ],
  },
  {
    id: "grp_015",
    title: "Recipe Exchange",
    senders: [
      { id: "hila_015@lid", name: "הילה" },
      { id: "maya_015@lid", name: "Maya" },
      { id: "tali_015@lid", name: "Tali" },
      { id: "erez_015@lid", name: "Erez" },
    ],
  },
];

export const initialBackfillGroups = simulatorGroups.slice(0, 10);
export const newGroupsAtSixtySeconds = simulatorGroups.slice(10, 12);
export const newGroupAtNinetySeconds = simulatorGroups.slice(12, 13);
