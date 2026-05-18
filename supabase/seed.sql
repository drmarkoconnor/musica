insert into tags (name, color) values
  ('harmony', 'green'),
  ('time feel', 'blue'),
  ('vocal', 'rose'),
  ('voicing', 'amber'),
  ('memory', 'slate')
on conflict (name) do nothing;

insert into pieces (
  title,
  composer,
  lyricist,
  musical_key,
  status,
  confidence,
  last_practised_on,
  target_tempo,
  current_tempo,
  spotify_url,
  is_spine_tune,
  notes
) values
  ('Autumn Leaves', 'Joseph Kosma', 'Jacques Prevert, Johnny Mercer', 'G minor', 'spine', 4, '2026-05-14', 132, 112, 'https://open.spotify.com/search/Autumn%20Leaves%20jazz', true, 'Keep the melody plain before adding fills.'),
  ('My Funny Valentine', 'Richard Rodgers', 'Lorenz Hart', 'C minor', 'spine', 4, '2026-05-15', 92, 78, 'https://open.spotify.com/search/My%20Funny%20Valentine', true, 'Vocal phrasing can lead the piano voicings.'),
  ('A Foggy Day', 'George Gershwin', 'Ira Gershwin', null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/A%20Foggy%20Day%20jazz', false, null),
  ('C Jam Blues', 'Duke Ellington', null, null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/C%20Jam%20Blues%20jazz', false, null),
  ('Come Sunday', 'Duke Ellington', null, null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/Come%20Sunday%20jazz', false, null),
  ('Doxy', 'Sonny Rollins', null, 'Bb', 'learning', 3, null, null, null, 'https://open.spotify.com/search/Doxy%20jazz', false, null),
  ('Fascinating Rhythm', 'George Gershwin', 'Ira Gershwin', null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/Fascinating%20Rhythm%20jazz', false, null),
  ('Fly Me to the Moon', 'Bart Howard', 'Bart Howard', 'C', 'learning', 3, null, null, null, 'https://open.spotify.com/search/Fly%20Me%20to%20the%20Moon%20jazz', false, null),
  ('Honeysuckle Rose', 'Fats Waller', 'Andy Razaf', null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/Honeysuckle%20Rose%20jazz', false, null),
  ('I Got Rhythm', 'George Gershwin', 'Ira Gershwin', null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/I%20Got%20Rhythm%20jazz', false, null),
  ('Jitterbug Waltz', 'Fats Waller', null, null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/Jitterbug%20Waltz%20jazz', false, null),
  ('My Foolish Heart', 'Victor Young', 'Ned Washington', null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/My%20Foolish%20Heart%20jazz', false, null),
  ('Nice Work If You Can Get It', 'George Gershwin', 'Ira Gershwin', null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/Nice%20Work%20If%20You%20Can%20Get%20It%20jazz', false, null),
  ('Night and Day', 'Cole Porter', 'Cole Porter', null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/Night%20and%20Day%20jazz', false, null),
  ('Oh Lady Be Good', 'George Gershwin', 'Ira Gershwin', null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/Oh%20Lady%20Be%20Good%20jazz', false, null),
  ('Perdido', 'Juan Tizol', null, null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/Perdido%20jazz', false, null),
  ('Prelude to a Kiss', 'Duke Ellington', 'Irving Gordon, Irving Mills', null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/Prelude%20to%20a%20Kiss%20jazz', false, null),
  ('Solitude', 'Duke Ellington', 'Eddie DeLange, Irving Mills', null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/Solitude%20jazz', false, null),
  ('Someday My Prince Will Come', 'Frank Churchill', 'Larry Morey', null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/Someday%20My%20Prince%20Will%20Come%20jazz', false, null),
  ('Summertime', 'George Gershwin', 'DuBose Heyward, Ira Gershwin', null, 'maintenance', 3, null, null, null, 'https://open.spotify.com/search/Summertime%20jazz', false, null),
  ('The Man I Love', 'George Gershwin', 'Ira Gershwin', null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/The%20Man%20I%20Love%20jazz', false, null),
  ('The Shadow of Your Smile', 'Johnny Mandel', 'Paul Francis Webster', null, 'learning', 3, null, null, null, 'https://open.spotify.com/search/The%20Shadow%20of%20Your%20Smile%20jazz', false, null);

insert into exercises (
  title,
  category,
  key_focus,
  confidence,
  last_practised_on,
  target_tempo,
  current_tempo,
  notes
) values
  ('LH root-5 / RH 3-7 through 12 keys', 'voicing', 'All keys', 3, '2026-05-12', 96, 72, 'Keep the left hand relaxed and quiet.'),
  ('ii-V-I drills through 12 keys', 'ii-v-i', 'Cycle of fifths', 3, '2026-05-10', 120, 88, 'Name guide tones out loud before increasing tempo.'),
  ('Minor scale theory reminders', 'minor_harmony', 'Natural, harmonic, melodic minor', 2, '2026-05-01', null, null, 'Connect each scale to a tune moment.'),
  ('Chord transition drills', 'transition', 'Close voice-leading', 2, '2026-04-29', 84, 58, 'Practise tiny moves between dense chords.'),
  ('Interval ear-training prompts', 'ear_training', 'Bass-baritone range', 4, '2026-05-16', null, null, 'Sing, play, then sing again without the piano.'),
  ('Two-bar rhythmic cells', 'rhythm', 'Comping placement', 3, '2026-05-06', 132, 104, 'Keep the cell consistent before reharmonising.');
