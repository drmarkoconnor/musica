# Lead Sheet Incorporation Plan

## Current Local Folder

Folder: `docs/leadsheets`

Observed contents:

- 22 PDF lead sheets
- Around 5.3 MB total
- Most files are small single-page style PDFs
- Largest files:
  - `I Got Rhythm - George Gershwin.pdf` around 2.1 MB
  - `Autumn Leaves - Joseph Kosma.pdf` around 960 KB

This is a small enough set that we can keep the v1 workflow simple.

## Recommended V1 Workflow

Use the existing `piece_assets` table and treat lead sheets as file assets linked
to repertoire pieces.

1. Import or upload PDF files.
2. Match each file to a `pieces` row by title.
3. Create a `piece_assets` row:
   - `piece_id`
   - `title`
   - `asset_type = lead_sheet_pdf`
   - `version_label = clean` or a short note
   - `storage_bucket`
   - `storage_path`
4. Show the lead sheet on the piece detail page using a simple embedded PDF
   viewer or open-in-new-tab link.

## Storage Choice

For local development, we can temporarily read from `docs/leadsheets`, or use
the app upload route and store files under the gitignored `docs/piece-assets`
folder.

For the hosted app, the files move to object storage rather than staying in the
repo:

- Netlify Blobs is the v1 storage bridge because it is already working for
  lesson audio.
- The blob store is `piece-assets`.
- Neon stores only `piece_assets` metadata.
- The protected server route `/api/piece-assets/[assetId]/file` streams the PDF
  or image back to the app.
- Cloudflare R2 remains a later option if we need cheaper/larger long-term
  object storage.

## Matching Notes

Several lead sheets correspond to seeded repertoire already:

- `Autumn Leaves - Joseph Kosma.pdf`
- `My Funny Valentine - Rodgers Hart.pdf`

Many others are not yet in the seeded 10 spine tunes. We can either:

- create repertoire pieces for every lead sheet during import, or
- only attach files to pieces that already exist and leave unmatched files in an
  import review list.

Recommended approach: create an import review screen/list so Mark can confirm
the title, key, and spine status before adding them to active repertoire.

## MVP Scope

Do this first:

- scan `docs/leadsheets`
- show file names and suggested tune titles
- let Mark choose `create piece` or `attach to existing piece`
- upload/copy file to storage
- create the `piece_assets` row

Current v1 implementation:

- `/assets/leadsheets` accepts multiple PDF, PNG, or JPG lead sheets
- upload matches known filenames from the catalogue where possible
- existing pieces are reused by normalized title
- missing pieces are created automatically
- existing matching asset rows are updated to point at the newly uploaded object

Do not build full annotation in v1. Uploading a new annotated version is enough.
