export type LeadSheetCatalogEntry = {
  filename: string;
  title: string;
  composer?: string;
  lyricist?: string;
  key?: string;
};

export const leadSheetCatalog: readonly LeadSheetCatalogEntry[] = [
  {
    filename: "A Foggy Day - George Gershwin.pdf",
    title: "A Foggy Day",
    composer: "George Gershwin",
    lyricist: "Ira Gershwin",
  },
  {
    filename: "Autumn Leaves - Joseph Kosma.pdf",
    title: "Autumn Leaves",
    composer: "Joseph Kosma",
    lyricist: "Jacques Prevert, Johnny Mercer",
  },
  {
    filename: "C Jam Blues - Duke Ellington.pdf",
    title: "C Jam Blues",
    composer: "Duke Ellington",
  },
  {
    filename: "Come Sunday - Duke Ellington.pdf",
    title: "Come Sunday",
    composer: "Duke Ellington",
  },
  {
    filename: "Fascinating Rhythm -George Gershwin.pdf",
    title: "Fascinating Rhythm",
    composer: "George Gershwin",
    lyricist: "Ira Gershwin",
  },
  {
    filename: "Fly Me to the Moon C.pdf",
    title: "Fly Me to the Moon",
    composer: "Bart Howard",
    lyricist: "Bart Howard",
    key: "C",
  },
  {
    filename: "Honeysuckle Rose - Fats Waller.pdf",
    title: "Honeysuckle Rose",
    composer: "Fats Waller",
    lyricist: "Andy Razaf",
  },
  {
    filename: "I Got Rhythm - George Gershwin.pdf",
    title: "I Got Rhythm",
    composer: "George Gershwin",
    lyricist: "Ira Gershwin",
  },
  {
    filename: "Jitterbug Waltz - Fats Waller.pdf",
    title: "Jitterbug Waltz",
    composer: "Fats Waller",
  },
  {
    filename: "My Foolish Heart - Victor Young.pdf",
    title: "My Foolish Heart",
    composer: "Victor Young",
    lyricist: "Ned Washington",
  },
  {
    filename: "My Funny Valentine - Rodgers Hart.pdf",
    title: "My Funny Valentine",
    composer: "Richard Rodgers",
    lyricist: "Lorenz Hart",
  },
  {
    filename: "Nice Work If You Can Get It - Gershwin.pdf",
    title: "Nice Work If You Can Get It",
    composer: "George Gershwin",
    lyricist: "Ira Gershwin",
  },
  {
    filename: "Night and Day - Cole Porter.pdf",
    title: "Night and Day",
    composer: "Cole Porter",
    lyricist: "Cole Porter",
  },
  {
    filename: "Oh Lady Be Good - George Gershwin.pdf",
    title: "Oh Lady Be Good",
    composer: "George Gershwin",
    lyricist: "Ira Gershwin",
  },
  {
    filename: "Perdido - Juan Tizol.pdf",
    title: "Perdido",
    composer: "Juan Tizol",
  },
  {
    filename: "Prelude to a Kiss - Duke Ellington.pdf",
    title: "Prelude to a Kiss",
    composer: "Duke Ellington",
    lyricist: "Irving Gordon, Irving Mills",
  },
  {
    filename: "Solitude - Duke Ellington.pdf",
    title: "Solitude",
    composer: "Duke Ellington",
    lyricist: "Eddie DeLange, Irving Mills",
  },
  {
    filename: "Someday My Prince Will Come - jazz waltz.pdf",
    title: "Someday My Prince Will Come",
    composer: "Frank Churchill",
    lyricist: "Larry Morey",
  },
  {
    filename: "Summertime - Mark.pdf",
    title: "Summertime",
    composer: "George Gershwin",
    lyricist: "DuBose Heyward, Ira Gershwin",
  },
  {
    filename: "The Man I Love - George Gershwin.pdf",
    title: "The Man I Love",
    composer: "George Gershwin",
    lyricist: "Ira Gershwin",
  },
  {
    filename: "The Shadow of Your Smile - Johnny Mandel.pdf",
    title: "The Shadow of Your Smile",
    composer: "Johnny Mandel",
    lyricist: "Paul Francis Webster",
  },
  {
    filename: "doxy-bb.pdf",
    title: "Doxy",
    composer: "Sonny Rollins",
    key: "Bb",
  },
];

export const leadSheetCatalogByFilename = Object.fromEntries(
  leadSheetCatalog.map((entry) => [entry.filename, entry]),
) as Record<string, LeadSheetCatalogEntry>;

export function leadSheetPieceId(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
