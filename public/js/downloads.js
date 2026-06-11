// ==========================================================
//  Detect when an assistant reply should offer downloadable
//  files, based on what the user asked for + the reply shape.
// ==========================================================

// Returns an array of { label, format, content, language, baseName, title }
export function detectDownloads(replyText, userPrompt = "") {
  const offers = [];
  const p = (userPrompt || "").toLowerCase();
  const slug = (userPrompt || "the-ark-ai")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "the-ark-ai";
  const title = (userPrompt || "The Ark AI Document").slice(0, 80);

  const wantsWord = /\b(word|docx|\.doc|document)\b/.test(p);
  const wantsPdf = /\bpdf\b/.test(p);
  const wantsTxt = /\b(txt|text file|plain text)\b/.test(p);
  const wantsMd = /\b(markdown|\.md)\b/.test(p);
  const wantsCsv = /\b(csv|spreadsheet)\b/.test(p);
  const wantsHtml = /\b(html file|web page|webpage)\b/.test(p);
  const wantsGeneric = /\b(download|downloadable|file|export|save (this|it) as)\b/.test(p);

  // long-form document-like content (essay/report/letter/notes/summary/story)
  const docLike = /\b(essay|report|letter|notes|summary|story|article|cover letter|cv|resume|plan|guide)\b/.test(p);

  if (wantsWord) offers.push(mk("Word document (.docx)", "docx"));
  if (wantsPdf) offers.push(mk("PDF document (.pdf)", "pdf"));
  if (wantsTxt) offers.push(mk("Text file (.txt)", "txt"));
  if (wantsMd) offers.push(mk("Markdown file (.md)", "md"));
  if (wantsCsv) offers.push(mk("CSV file (.csv)", "csv"));
  if (wantsHtml) offers.push(mk("HTML file (.html)", "html"));

  // If they asked to download something but didn't name a type, offer the common ones
  if (!offers.length && (wantsGeneric || docLike) && replyText.trim().length > 120) {
    offers.push(mk("Word document (.docx)", "docx"));
    offers.push(mk("PDF document (.pdf)", "pdf"));
  }

  return offers;

  function mk(label, format) {
    return { label, format, content: replyText, baseName: slug, title };
  }
}
